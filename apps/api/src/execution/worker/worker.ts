import { readAIExecutionReport } from "@/ai";
import type { PipelineStage } from "@/pipeline/contracts/pipeline-stage";
import type { StageExecutionInfo } from "@/pipeline/contracts/stage-result";
import { stageSucceeded } from "@/pipeline/contracts/stage-result";
import { DEFAULT_PIPELINE_CONFIGURATION, PipelineContext } from "@/pipeline/context";
import type { NormalizedDataset } from "@/pipeline/domain/normalization";
import type { ParsedDataset } from "@/pipeline/domain/parsing";
import type { SemanticExtractionResult } from "@/pipeline/domain/extraction";
import type { ValidationResult } from "@/pipeline/domain/validation";
import type { Logger } from "@/core/logger";
import type { BatchExecutionResult, ExecutionBatch } from "@/execution/batch/batch-model";

/**
 * The three existing pipeline stages a worker chains — Prompt Compilation
 * and AI Execution both already live inside `semanticExtraction`
 * (`SemanticExtractionStage` wraps `AIOrchestrator`, which wraps `@/prompt`
 * and the provider call), and the Trust Layer already lives inside
 * `validation` (`ValidationStage` wraps `runTrustLayer()`). Nothing here
 * reimplements any of that — "Reuse existing pipeline stages. Do NOT
 * duplicate business logic."
 */
export interface WorkerStageSet {
  readonly normalization: PipelineStage<ParsedDataset, NormalizedDataset>;
  readonly semanticExtraction: PipelineStage<NormalizedDataset, SemanticExtractionResult>;
  readonly validation: PipelineStage<SemanticExtractionResult, ValidationResult>;
}

/**
 * Executes exactly one batch, start to finish, through Normalization ->
 * Semantic Analysis/AI/Prompt Compilation -> Trust Layer. A worker is a pure
 * executor: it holds no reference to the pool that dispatches it or to any
 * other worker, and its `WorkerStageSet` is safe to share across every
 * worker in the pool (none of the three stages hold per-call mutable
 * instance state — each `.execute()` call is independent). Each batch gets
 * its own fresh `PipelineContext`, scoped by `batchId`, because the stage
 * contract (`PipelineStage<TInput, TOutput>`) requires one and a batch is,
 * from the stage machinery's point of view, its own tiny "import".
 */
export class Worker {
  constructor(
    readonly workerId: string,
    private readonly stages: WorkerStageSet,
    private readonly logger?: Logger,
  ) {}

  async execute(batch: ExecutionBatch): Promise<BatchExecutionResult> {
    const startedAt = new Date();
    let context = PipelineContext.create(batch.batchId, DEFAULT_PIPELINE_CONFIGURATION);

    const normalizeExecution = await this.stages.normalization.execute(
      batch.parsedDataset,
      context,
    );
    context = normalizeExecution.context;
    if (!stageSucceeded(normalizeExecution.result)) {
      return this.failureResult(batch, startedAt, normalizeExecution.result.info, null, null);
    }
    const normalizedDataset = normalizeExecution.result.output;

    const extractExecution = await this.stages.semanticExtraction.execute(
      normalizedDataset,
      context,
    );
    context = extractExecution.context;
    if (!stageSucceeded(extractExecution.result)) {
      return this.failureResult(
        batch,
        startedAt,
        extractExecution.result.info,
        normalizedDataset.report,
        readAIExecutionReport(context) ?? null,
      );
    }

    const validateExecution = await this.stages.validation.execute(
      extractExecution.result.output,
      context,
    );
    context = validateExecution.context;
    const aiReport = readAIExecutionReport(context) ?? null;

    if (!stageSucceeded(validateExecution.result)) {
      return this.failureResult(
        batch,
        startedAt,
        validateExecution.result.info,
        normalizedDataset.report,
        aiReport,
      );
    }

    const completedAt = new Date();
    return {
      batchId: batch.batchId,
      sequenceNumber: batch.sequenceNumber,
      status: "completed",
      validation: validateExecution.result.output,
      aiReport,
      normalizationReport: normalizedDataset.report,
      warnings: [
        ...normalizeExecution.result.info.warnings,
        ...extractExecution.result.info.warnings,
        ...validateExecution.result.info.warnings,
      ],
      errors: [],
      timing: {
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
      statistics: { recordCount: batch.recordCount },
    };
  }

  private failureResult(
    batch: ExecutionBatch,
    startedAt: Date,
    info: StageExecutionInfo,
    normalizationReport: BatchExecutionResult["normalizationReport"],
    aiReport: BatchExecutionResult["aiReport"],
  ): BatchExecutionResult {
    const completedAt = new Date();
    this.logger?.error("execution.worker.batch_failed", {
      workerId: this.workerId,
      batchId: batch.batchId,
      stage: info.stageName,
    });

    return {
      batchId: batch.batchId,
      sequenceNumber: batch.sequenceNumber,
      status: "failed",
      validation: null,
      aiReport,
      normalizationReport,
      warnings: info.warnings,
      errors:
        info.errors.length > 0
          ? info.errors
          : [
              {
                code: "BATCH_STAGE_FAILED",
                message: `Batch failed at stage "${info.stageName}".`,
              },
            ],
      timing: {
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
      statistics: { recordCount: batch.recordCount },
    };
  }
}
