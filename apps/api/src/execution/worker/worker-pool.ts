import type { Logger } from "@/core/logger";
import type { BatchExecutionResult, ExecutionBatch } from "@/execution/batch/batch-model";
import type { CancellationToken } from "@/execution/cancellation/cancellation-token";
import {
  DEFAULT_EXECUTION_CONFIG,
  type ExecutionConfig,
} from "@/execution/config/execution-config";
import type { ExecutionEvent } from "@/execution/events/execution-event";
import type { ExecutionEventBus } from "@/execution/events/execution-event-bus";
import { Worker, type WorkerStageSet } from "@/execution/worker/worker";

export interface WorkerPoolOptions {
  readonly stages: WorkerStageSet;
  readonly config?: ExecutionConfig;
  readonly eventBus?: ExecutionEventBus;
  readonly cancellationToken?: CancellationToken;
  readonly logger?: Logger;
}

function isoNow(): string {
  return new Date().toISOString();
}

/**
 * `config.workerCount` independent `Worker`s pull batches off one shared
 * queue until it's empty — the classic "N consumers, one counter" pattern:
 * each worker's loop does a synchronous `nextIndex++` before its first
 * `await`, so two workers can never claim the same batch despite running
 * concurrently (JS has no true parallelism here, only interleaved async
 * execution, which is exactly what makes the plain counter safe without a
 * lock). No worker ever sees another worker or the pool itself — only its
 * own `WorkerStageSet` and whichever batch it just claimed. Cancellation is
 * checked before claiming each new batch, never mid-batch: an in-flight
 * batch always finishes ("Graceful Worker Termination").
 */
export class WorkerPool {
  private readonly workers: readonly Worker[];

  constructor(private readonly options: WorkerPoolOptions) {
    const config = options.config ?? DEFAULT_EXECUTION_CONFIG;
    this.workers = Array.from(
      { length: config.workerCount },
      (_, index) => new Worker(`worker-${index + 1}`, options.stages, options.logger),
    );
  }

  get workerCount(): number {
    return this.workers.length;
  }

  /**
   * Returns one slot per input batch, in order. A batch that was never
   * claimed (cancellation fired before a worker reached it) leaves its slot
   * `undefined` — the caller (`ExecutionEngine`) is responsible for turning
   * that into an explicit `"cancelled"` `BatchExecutionResult` rather than
   * silently dropping it, so "never discard successful work" also means
   * "never silently discard the *fact* that a batch didn't run."
   */
  async runAll(
    batches: readonly ExecutionBatch[],
    executionId: string,
  ): Promise<readonly (BatchExecutionResult | undefined)[]> {
    const results: (BatchExecutionResult | undefined)[] = new Array(batches.length);
    let nextIndex = 0;

    const runWorkerLoop = async (worker: Worker): Promise<void> => {
      for (;;) {
        if (this.options.cancellationToken?.isCancelled) {
          return;
        }
        const index = nextIndex;
        if (index >= batches.length) {
          return;
        }
        nextIndex += 1;
        const batch = batches[index];

        this.publish({
          type: "WorkerAssigned",
          executionId,
          workerId: worker.workerId,
          batchId: batch.batchId,
          occurredAt: isoNow(),
        });
        this.publish({
          type: "BatchStarted",
          executionId,
          batchId: batch.batchId,
          occurredAt: isoNow(),
          workerId: worker.workerId,
        });

        const result = await worker.execute(batch);
        results[index] = result;

        this.publish({
          type: "BatchCompleted",
          executionId,
          batchId: batch.batchId,
          occurredAt: isoNow(),
          result,
        });
      }
    };

    await Promise.all(this.workers.map(runWorkerLoop));
    return results;
  }

  private publish(event: ExecutionEvent): void {
    this.options.eventBus?.publish(event);
  }
}
