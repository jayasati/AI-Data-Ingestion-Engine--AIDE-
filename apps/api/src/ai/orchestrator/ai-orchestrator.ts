import { randomUUID } from "node:crypto";
import type { AIConfig } from "@/config/ai-config";
import type { Logger } from "@/core/logger";
import { AIProviderError } from "@/ai/contracts/ai-error";
import type {
  AIExecutionReport,
  AIExecutionStatus,
  ParserDiagnostic,
} from "@/ai/contracts/execution";
import type { AIRequest, AIResponse, LLMProvider } from "@/ai/contracts/llm-provider";
import { buildDatasetContext, type DatasetContext } from "@/ai/context/dataset-context-builder";
import { estimateCostUsd } from "@/ai/orchestrator/token-estimator";
import { parseAIResponse, validateAndMapExtraction } from "@/ai/response";
import { OUTPUT_SCHEMA_VERSION } from "@/ai/schema/crm-output-schema";
import type { StageIssue } from "@/pipeline/contracts/stage-result";
import type { SemanticExtractionResult } from "@/pipeline/domain/extraction";
import type { NormalizedDataset } from "@/pipeline/domain/normalization";
import { buildSemanticContext } from "@/semantic/context/semantic-context-builder";
import { analyzeSemantics, type SemanticAnalysisResult } from "@/semantic/semantic-engine";
import {
  compilePrompt,
  PROMPT_VERSION,
  PromptCompilationError,
  type CompiledPrompt,
  type PromptExecutionMetadata,
} from "@/prompt";

export interface OrchestratorRequest {
  readonly normalizedDataset: NormalizedDataset;
  /** Pre-built context, if the caller already has one; otherwise the orchestrator builds it. */
  readonly datasetContext?: DatasetContext;
}

export interface OrchestratorResult {
  readonly extraction: SemanticExtractionResult;
  readonly report: AIExecutionReport;
}

const EMPTY_USAGE = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

/**
 * Chooses nothing provider-specific — it only knows `LLMProvider`. Owns
 * compiling the prompt (via the Prompt Engineering Platform, `@/prompt`),
 * calling the provider once, parsing and validating the response, and
 * assembling the execution report. Does not retry (single attempt only):
 * `AIConfig.retryPolicy` is a placeholder field for a future retry-aware
 * volume, and does not loop here ("NO Retry Engine" this volume). Does not
 * run batches in parallel: one call, one dataset's worth of records, treated
 * as a single batch — see ai/contracts/batch.ts for why.
 */
export class AIOrchestrator {
  constructor(
    private readonly provider: LLMProvider,
    private readonly config: AIConfig,
    private readonly logger?: Logger,
  ) {}

  async run(request: OrchestratorRequest): Promise<OrchestratorResult> {
    const requestId = randomUUID();
    const startedAt = new Date();

    const semanticResult: SemanticAnalysisResult | undefined = request.datasetContext
      ? undefined
      : analyzeSemantics(request.normalizedDataset);
    const datasetContext =
      request.datasetContext ??
      buildDatasetContext(request.normalizedDataset, buildSemanticContext(semanticResult!));

    let compiled: CompiledPrompt;
    try {
      compiled = compilePrompt({
        datasetContext,
        normalizationReport: request.normalizedDataset.report,
        columnProfiles: semanticResult?.columnProfiles,
        batch: request.normalizedDataset.records,
        supportsJsonMode: this.provider.capabilities.supportsJsonMode,
        model: this.config.model,
        maxContextTokens: this.provider.capabilities.maxContextTokens,
      });
    } catch (error) {
      return this.buildCompilationFailureResult(requestId, startedAt, error);
    }

    const aiRequest: AIRequest = {
      messages: [
        { role: "system", content: compiled.systemMessage },
        { role: "user", content: compiled.userMessage },
      ],
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      timeoutMs: this.config.timeoutMs,
    };

    this.logger?.info("ai.request.started", {
      requestId,
      provider: this.provider.id,
      model: this.config.model,
      estimatedTokens: compiled.estimatedTokens,
      examplesUsed: compiled.examplesUsed,
      negativeExamplesUsed: compiled.negativeExamplesUsed,
      promptHash: compiled.promptHash,
    });

    let response: AIResponse;
    try {
      response = await this.provider.complete(aiRequest);
    } catch (error) {
      return this.buildFailureResult(requestId, startedAt, "provider_error", error, compiled);
    }

    const parsed = parseAIResponse(response.text);
    if (!parsed.success) {
      return this.buildParserFailureResult(
        requestId,
        startedAt,
        response,
        parsed.diagnostics,
        compiled,
      );
    }

    const validation = validateAndMapExtraction(parsed.data);
    const completedAt = new Date();

    const report: AIExecutionReport = {
      requestId,
      provider: this.provider.id,
      model: response.model,
      promptVersion: compiled.promptVersion,
      schemaVersion: OUTPUT_SCHEMA_VERSION,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      latencyMs: completedAt.getTime() - startedAt.getTime(),
      tokenUsage: response.usage,
      estimatedCostUsd: estimateCostUsd(response.model, response.usage),
      status: "success",
      warnings: [...validation.warnings, ...parsed.diagnostics.map(toStageIssue)],
      parserDiagnostics: parsed.diagnostics,
      promptMetadata: compiled.metadata,
    };

    this.logger?.info("ai.request.completed", {
      requestId,
      status: report.status,
      latencyMs: report.latencyMs,
      totalTokens: report.tokenUsage.totalTokens,
      warningCount: report.warnings.length,
    });

    return { extraction: validation.extraction, report };
  }

  private buildCompilationFailureResult(
    requestId: string,
    startedAt: Date,
    error: unknown,
  ): OrchestratorResult {
    const completedAt = new Date();
    const message = error instanceof Error ? error.message : String(error);
    const code =
      error instanceof PromptCompilationError ? "PROMPT_COMPILATION_FAILED" : "AI_UNKNOWN_ERROR";

    this.logger?.error("ai.prompt.compilation_failed", { requestId, message });

    const report: AIExecutionReport = {
      requestId,
      provider: this.provider.id,
      model: this.config.model,
      promptVersion: PROMPT_VERSION,
      schemaVersion: OUTPUT_SCHEMA_VERSION,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      latencyMs: completedAt.getTime() - startedAt.getTime(),
      tokenUsage: EMPTY_USAGE,
      estimatedCostUsd: null,
      status: "compilation_error",
      warnings: [{ code, message }],
      parserDiagnostics: [],
      promptMetadata: null,
    };

    return { extraction: { records: [] }, report };
  }

  private buildFailureResult(
    requestId: string,
    startedAt: Date,
    status: AIExecutionStatus,
    error: unknown,
    compiled: CompiledPrompt,
  ): OrchestratorResult {
    const completedAt = new Date();
    const code = error instanceof AIProviderError ? error.code : "AI_UNKNOWN_ERROR";
    const message = error instanceof Error ? error.message : String(error);

    this.logger?.error("ai.request.failed", { requestId, status, code, message });

    const report: AIExecutionReport = {
      requestId,
      provider: this.provider.id,
      model: this.config.model,
      promptVersion: compiled.promptVersion,
      schemaVersion: OUTPUT_SCHEMA_VERSION,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      latencyMs: completedAt.getTime() - startedAt.getTime(),
      tokenUsage: EMPTY_USAGE,
      estimatedCostUsd: null,
      status,
      warnings: [{ code, message }],
      parserDiagnostics: [],
      promptMetadata: compiled.metadata,
    };

    return { extraction: { records: [] }, report };
  }

  private buildParserFailureResult(
    requestId: string,
    startedAt: Date,
    response: AIResponse,
    diagnostics: readonly ParserDiagnostic[],
    compiled: CompiledPrompt,
  ): OrchestratorResult {
    const completedAt = new Date();
    this.logger?.warn("ai.response.parse_failed", { requestId, diagnostics });

    const report: AIExecutionReport = {
      requestId,
      provider: this.provider.id,
      model: response.model,
      promptVersion: compiled.promptVersion,
      schemaVersion: OUTPUT_SCHEMA_VERSION,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      latencyMs: completedAt.getTime() - startedAt.getTime(),
      tokenUsage: response.usage,
      estimatedCostUsd: estimateCostUsd(response.model, response.usage),
      status: "parser_error",
      warnings: diagnostics.map(toStageIssue),
      parserDiagnostics: diagnostics,
      promptMetadata: compiled.metadata,
    };

    return { extraction: { records: [] }, report };
  }
}

function toStageIssue(diagnostic: ParserDiagnostic): StageIssue {
  return { code: diagnostic.code, message: diagnostic.message };
}

export type { PromptExecutionMetadata };
