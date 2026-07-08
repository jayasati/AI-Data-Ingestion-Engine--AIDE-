import { randomUUID } from "node:crypto";
import type { Logger } from "@/core/logger";
import type { ParsedDataset } from "@/pipeline/domain/parsing";
import { aggregateResults } from "@/execution/aggregation/aggregation-engine";
import type { ImportResult } from "@/execution/aggregation/import-result";
import { scheduleBatches } from "@/execution/batch/batch-scheduler";
import type { BatchExecutionResult, ExecutionBatch } from "@/execution/batch/batch-model";
import { CancellationToken } from "@/execution/cancellation/cancellation-token";
import {
  DEFAULT_EXECUTION_CONFIG,
  type ExecutionConfig,
} from "@/execution/config/execution-config";
import { ExecutionContext } from "@/execution/context/execution-context";
import { ExecutionEventBus } from "@/execution/events/execution-event-bus";
import { computeExecutionMetrics } from "@/execution/metrics/execution-metrics";
import { ExecutionState } from "@/execution/state/execution-state";
import { WorkerPool } from "@/execution/worker/worker-pool";
import type { WorkerStageSet } from "@/execution/worker/worker";

export interface ExecutionRequest {
  readonly importId: string;
  readonly parsedDataset: ParsedDataset;
  readonly stages: WorkerStageSet;
  readonly config?: Partial<ExecutionConfig>;
  readonly eventBus?: ExecutionEventBus;
  readonly cancellationToken?: CancellationToken;
  readonly logger?: Logger;
}

export interface ExecutionEngineResult {
  readonly context: ExecutionContext;
  readonly result: ImportResult;
}

function isoNow(): string {
  return new Date().toISOString();
}

function safeTransitionToFailed(context: ExecutionContext): ExecutionContext {
  try {
    return context.transitionTo(ExecutionState.Failed);
  } catch {
    return context;
  }
}

/**
 * Fills every batch that never got a real result (cancellation fired before
 * a worker claimed it) with an explicit `"cancelled"` `BatchExecutionResult`
 * — the same partial-success principle as a batch that ran and failed:
 * never silently drop it, always say what happened.
 */
function reconcileResults(
  batches: readonly ExecutionBatch[],
  rawResults: readonly (BatchExecutionResult | undefined)[],
  cancellationReason: string | null,
): readonly BatchExecutionResult[] {
  return batches.map((batch, index) => {
    const existing = rawResults[index];
    if (existing) {
      return existing;
    }
    const now = isoNow();
    return {
      batchId: batch.batchId,
      sequenceNumber: batch.sequenceNumber,
      status: "cancelled",
      validation: null,
      aiReport: null,
      normalizationReport: null,
      warnings: [],
      errors: [
        {
          code: "BATCH_CANCELLED",
          message: cancellationReason ?? "Batch was never dispatched before the execution ended.",
        },
      ],
      timing: { startedAt: now, completedAt: now, durationMs: 0 },
      statistics: { recordCount: batch.recordCount },
    };
  });
}

/**
 * The Execution Platform's top-level entry point — `PipelineRunner`'s
 * counterpart one layer up: where `PipelineRunner` sequences six stages for
 * one dataset, `ExecutionEngine` schedules that same stage sequence
 * (Normalization through the Trust Layer, via `WorkerStageSet`) across N
 * concurrent batches, tracks progress, and aggregates the results. Knows
 * nothing about CRM business rules — only how work is split, dispatched,
 * and collected.
 *
 * Execution-level timeout is implemented via the same cooperative
 * cancellation the Worker Pool already respects: a timer requests
 * cancellation if `config.executionTimeoutMs` elapses, so a timeout still
 * yields every batch that finished before it fired, never a hard discard of
 * completed work.
 */
export class ExecutionEngine {
  async run(request: ExecutionRequest): Promise<ExecutionEngineResult> {
    const executionId = randomUUID();
    const config: ExecutionConfig = request.config
      ? { ...DEFAULT_EXECUTION_CONFIG, ...request.config }
      : DEFAULT_EXECUTION_CONFIG;
    const eventBus = request.eventBus ?? new ExecutionEventBus();
    const cancellationToken = request.cancellationToken ?? new CancellationToken();
    const executionStartedAt = new Date();

    let context = ExecutionContext.create(request.importId, executionId, config);

    const timeoutTimer = setTimeout(() => {
      cancellationToken.cancel(`Execution exceeded its ${config.executionTimeoutMs}ms timeout.`);
    }, config.executionTimeoutMs);

    try {
      context = context.transitionTo(ExecutionState.Queued).transitionTo(ExecutionState.Preparing);

      const batches = scheduleBatches(request.parsedDataset, request.importId, config);

      eventBus.publish({
        type: "ExecutionStarted",
        executionId,
        importId: request.importId,
        occurredAt: isoNow(),
        totalBatches: batches.length,
      });
      for (const batch of batches) {
        eventBus.publish({
          type: "BatchCreated",
          executionId,
          batchId: batch.batchId,
          occurredAt: isoNow(),
          recordCount: batch.recordCount,
        });
      }

      context = context.transitionTo(ExecutionState.Running);

      const pool = new WorkerPool({
        stages: request.stages,
        config,
        eventBus,
        cancellationToken,
        logger: request.logger,
      });
      const rawResults = await pool.runAll(batches, executionId);
      const batchResults = reconcileResults(
        batches,
        rawResults,
        cancellationToken.cancellationReason,
      );

      const wasCancelled = cancellationToken.isCancelled;
      if (wasCancelled) {
        context = context
          .transitionTo(ExecutionState.Cancelling)
          .transitionTo(ExecutionState.Cancelled);
      } else {
        // Transition all the way to the terminal state *before* building
        // ImportResult — aggregateResults() reads context.currentState into
        // ImportResult.finalState, so building it while still "Aggregating"
        // would stamp that transient state onto the final result instead of
        // the terminal one the caller actually observes on `context`.
        context = context
          .transitionTo(ExecutionState.Aggregating)
          .transitionTo(ExecutionState.Completed);
      }

      const executionCompletedAt = new Date();
      const metrics = computeExecutionMetrics(
        batchResults,
        config.workerCount,
        executionCompletedAt.getTime() - executionStartedAt.getTime(),
      );
      const importResult = aggregateResults(
        context,
        batches,
        batchResults,
        metrics,
        executionCompletedAt,
      );

      if (wasCancelled) {
        eventBus.publish({
          type: "ExecutionCancelled",
          executionId,
          occurredAt: isoNow(),
          reason: cancellationToken.cancellationReason,
        });
      } else {
        eventBus.publish({
          type: "ExecutionCompleted",
          executionId,
          occurredAt: isoNow(),
          durationMs: importResult.durationMs,
        });
      }

      return { context, result: importResult };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedContext = safeTransitionToFailed(context);
      request.logger?.error("execution.engine.failed", { executionId, message });
      eventBus.publish({
        type: "ExecutionFailed",
        executionId,
        occurredAt: isoNow(),
        reason: message,
      });

      const metrics = computeExecutionMetrics(
        [],
        config.workerCount,
        Date.now() - executionStartedAt.getTime(),
      );
      const importResult = aggregateResults(failedContext, [], [], metrics);
      return { context: failedContext, result: importResult };
    } finally {
      clearTimeout(timeoutTimer);
    }
  }
}
