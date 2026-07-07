import { randomUUID } from "node:crypto";
import type { Logger } from "@/core/logger";
import {
  DEFAULT_PIPELINE_CONFIGURATION,
  ImportState,
  PipelineContext,
  type PipelineConfiguration,
} from "@/pipeline/context";
import type { PipelineStage } from "@/pipeline/contracts/pipeline-stage";
import type { ExecutionReport, PipelineRunResult } from "@/pipeline/contracts/execution-report";
import type { StageExecutionInfo, StageMetadata } from "@/pipeline/contracts/stage-result";
import type { RawUploadInput } from "@/pipeline/domain/upload";
import { PipelineEventBus, type PipelineEvent } from "@/pipeline/events";
import type { PipelineStageSet } from "@/pipeline/runner/pipeline-stage-set";

interface StageStepResult<TOutput> {
  readonly context: PipelineContext;
  readonly output: TOutput | null;
}

/**
 * The only thing in the pipeline that knows the six stages exist and what
 * order they run in. Executes them sequentially, propagates the context
 * returned by each, and halts on the first stage that produces no output.
 * Deliberately knows nothing about what any stage does internally — swapping
 * the Semantic Extraction placeholder for a real AI adapter later requires no
 * change here, because the contract (`PipelineStage<TInput, TOutput>`) is unchanged.
 */
export class PipelineRunner {
  constructor(
    private readonly stages: PipelineStageSet,
    private readonly eventBus: PipelineEventBus = new PipelineEventBus(),
    private readonly logger?: Logger,
  ) {}

  get events(): PipelineEventBus {
    return this.eventBus;
  }

  async run(
    rawInput: RawUploadInput,
    configuration: PipelineConfiguration = DEFAULT_PIPELINE_CONFIGURATION,
  ): Promise<PipelineRunResult> {
    const runStartedAt = new Date();
    let context = PipelineContext.create(randomUUID(), configuration);
    this.publish({ type: "ImportCreated", importId: context.importId, occurredAt: isoNow() });

    const upload = await this.runStage(this.stages.upload, rawInput, context);
    context = upload.context;
    if (upload.output === null) {
      return this.haltAndFinalize(context, runStartedAt, "upload");
    }
    context = context.transitionTo(ImportState.Uploaded);
    this.publish({
      type: "UploadCompleted",
      importId: context.importId,
      occurredAt: isoNow(),
      metadata: this.lastStageMetadata(context),
    });

    const parsed = await this.runStage(this.stages.csvParsing, upload.output, context);
    context = parsed.context;
    if (parsed.output === null) {
      return this.haltAndFinalize(context, runStartedAt, "csv-parsing");
    }
    context = context.transitionTo(ImportState.Parsed);
    this.publish({
      type: "CSVParsed",
      importId: context.importId,
      occurredAt: isoNow(),
      metadata: this.lastStageMetadata(context),
    });

    const normalized = await this.runStage(this.stages.normalization, parsed.output, context);
    context = normalized.context;
    if (normalized.output === null) {
      return this.haltAndFinalize(context, runStartedAt, "normalization");
    }
    context = context.transitionTo(ImportState.Normalized);
    this.publish({
      type: "NormalizationCompleted",
      importId: context.importId,
      occurredAt: isoNow(),
      metadata: this.lastStageMetadata(context),
    });

    // Entering the AI phase is not any single stage's output — the runner
    // marks it explicitly before Semantic Extraction begins.
    context = context.transitionTo(ImportState.AIProcessing);
    const extracted = await this.runStage(
      this.stages.semanticExtraction,
      normalized.output,
      context,
    );
    context = extracted.context;
    if (extracted.output === null) {
      return this.haltAndFinalize(context, runStartedAt, "semantic-extraction");
    }

    const validated = await this.runStage(this.stages.validation, extracted.output, context);
    context = validated.context;
    if (validated.output === null) {
      return this.haltAndFinalize(context, runStartedAt, "validation");
    }
    context = context.transitionTo(ImportState.Validated);

    const aggregated = await this.runStage(this.stages.aggregation, validated.output, context);
    context = aggregated.context;
    if (aggregated.output === null) {
      return this.haltAndFinalize(context, runStartedAt, "aggregation");
    }
    context = context.transitionTo(ImportState.Aggregated).transitionTo(ImportState.Completed);

    this.publish({
      type: "PipelineCompleted",
      importId: context.importId,
      occurredAt: isoNow(),
      summary: aggregated.output,
    });

    return this.buildResult(context, runStartedAt);
  }

  /**
   * Runs one stage, folding its result into the context and normalizing both
   * an expected `fatal_failure`/`recoverable_failure` StageResult AND an
   * unexpected thrown error into the same shape: no output, context updated
   * with a recorded stage-execution entry. See PipelineStage's contract for
   * why stages should throw only for genuine bugs.
   */
  private async runStage<TInput, TOutput>(
    stage: PipelineStage<TInput, TOutput>,
    input: TInput,
    context: PipelineContext,
  ): Promise<StageStepResult<TOutput>> {
    try {
      const execution = await stage.execute(input, context);
      const contextWithHistory = execution.context.recordStageExecution(execution.result.info);
      this.logStageOutcome(stage.name, execution.result.info);

      if (execution.result.outcome === "success" || execution.result.outcome === "warning") {
        return { context: contextWithHistory, output: execution.result.output };
      }
      return { context: contextWithHistory, output: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const info: StageExecutionInfo = {
        stageName: stage.name,
        outcome: "fatal_failure",
        timing: { startedAt: isoNow(), completedAt: isoNow(), durationMs: 0 },
        metadata: {},
        warnings: [],
        errors: [{ code: "STAGE_UNEXPECTED_ERROR", message }],
      };
      this.logger?.error("pipeline.stage.unexpected_error", { stage: stage.name, message });
      return { context: context.recordStageExecution(info), output: null };
    }
  }

  private haltAndFinalize(
    context: PipelineContext,
    runStartedAt: Date,
    failedStageName: string,
  ): PipelineRunResult {
    const failedContext = context.transitionTo(ImportState.Failed);
    const lastInfo = failedContext.stageHistory[failedContext.stageHistory.length - 1];
    const reason = lastInfo?.errors[0]?.message ?? `${failedStageName} failed.`;
    this.publish({
      type: "PipelineFailed",
      importId: failedContext.importId,
      occurredAt: isoNow(),
      reason,
    });
    return this.buildResult(failedContext, runStartedAt);
  }

  private buildResult(context: PipelineContext, runStartedAt: Date): PipelineRunResult {
    const completedAt = new Date();
    const report: ExecutionReport = {
      importId: context.importId,
      finalState: context.currentState,
      stages: context.stageHistory,
      warnings: context.warnings,
      errors: context.errors,
      startedAt: runStartedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - runStartedAt.getTime(),
    };
    return { context, report };
  }

  private lastStageMetadata(context: PipelineContext): StageMetadata {
    return context.stageHistory[context.stageHistory.length - 1]?.metadata ?? {};
  }

  private logStageOutcome(stageName: string, info: StageExecutionInfo): void {
    if (!this.logger) {
      return;
    }
    const level =
      info.outcome === "success" ? "debug" : info.outcome === "warning" ? "warn" : "error";
    this.logger[level](`pipeline.stage.${info.outcome}`, {
      stage: stageName,
      durationMs: info.timing.durationMs,
    });
  }

  private publish(event: PipelineEvent): void {
    this.eventBus.publish(event);
  }
}

function isoNow(): string {
  return new Date().toISOString();
}
