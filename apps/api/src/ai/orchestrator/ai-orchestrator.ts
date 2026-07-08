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
import { compilePrompt, PROMPT_VERSION } from "@/ai/prompt/prompt-compiler";
import { estimateCostUsd } from "@/ai/orchestrator/token-estimator";
import { parseAIResponse, validateAndMapExtraction } from "@/ai/response";
import { OUTPUT_SCHEMA_VERSION } from "@/ai/schema/crm-output-schema";
import type { StageIssue } from "@/pipeline/contracts/stage-result";
import type { SemanticExtractionResult } from "@/pipeline/domain/extraction";
import type { NormalizedDataset } from "@/pipeline/domain/normalization";

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
 * compiling the prompt, calling the provider once, parsing and validating
 * the response, and assembling the execution report. Does not retry (single
 * attempt only): `AIConfig.retryPolicy` is a placeholder field for a future
 * retry-aware volume, and does not loop here ("NO Retry Engine" this volume).
 * Does not run batches in parallel: one call, one dataset's worth of records,
 * treated as a single batch — see ai/contracts/batch.ts for why.
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
    const datasetContext = request.datasetContext ?? buildDatasetContext(request.normalizedDataset);

    const compiled = compilePrompt({
      datasetContext,
      batch: request.normalizedDataset.records,
      supportsJsonMode: this.provider.capabilities.supportsJsonMode,
    });

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
    });

    let response: AIResponse;
    try {
      response = await this.provider.complete(aiRequest);
    } catch (error) {
      return this.buildFailureResult(requestId, startedAt, "provider_error", error);
    }

    const parsed = parseAIResponse(response.text);
    if (!parsed.success) {
      return this.buildParserFailureResult(requestId, startedAt, response, parsed.diagnostics);
    }

    const validation = validateAndMapExtraction(parsed.data);
    const completedAt = new Date();

    const report: AIExecutionReport = {
      requestId,
      provider: this.provider.id,
      model: response.model,
      promptVersion: PROMPT_VERSION,
      schemaVersion: OUTPUT_SCHEMA_VERSION,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      latencyMs: completedAt.getTime() - startedAt.getTime(),
      tokenUsage: response.usage,
      estimatedCostUsd: estimateCostUsd(response.model, response.usage),
      status: "success",
      warnings: [...validation.warnings, ...parsed.diagnostics.map(toStageIssue)],
      parserDiagnostics: parsed.diagnostics,
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

  private buildFailureResult(
    requestId: string,
    startedAt: Date,
    status: AIExecutionStatus,
    error: unknown,
  ): OrchestratorResult {
    const completedAt = new Date();
    const code = error instanceof AIProviderError ? error.code : "AI_UNKNOWN_ERROR";
    const message = error instanceof Error ? error.message : String(error);

    this.logger?.error("ai.request.failed", { requestId, status, code, message });

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
      status,
      warnings: [{ code, message }],
      parserDiagnostics: [],
    };

    return { extraction: { records: [] }, report };
  }

  private buildParserFailureResult(
    requestId: string,
    startedAt: Date,
    response: AIResponse,
    diagnostics: readonly ParserDiagnostic[],
  ): OrchestratorResult {
    const completedAt = new Date();
    this.logger?.warn("ai.response.parse_failed", { requestId, diagnostics });

    const report: AIExecutionReport = {
      requestId,
      provider: this.provider.id,
      model: response.model,
      promptVersion: PROMPT_VERSION,
      schemaVersion: OUTPUT_SCHEMA_VERSION,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      latencyMs: completedAt.getTime() - startedAt.getTime(),
      tokenUsage: response.usage,
      estimatedCostUsd: estimateCostUsd(response.model, response.usage),
      status: "parser_error",
      warnings: diagnostics.map(toStageIssue),
      parserDiagnostics: diagnostics,
    };

    return { extraction: { records: [] }, report };
  }
}

function toStageIssue(diagnostic: ParserDiagnostic): StageIssue {
  return { code: diagnostic.code, message: diagnostic.message };
}
