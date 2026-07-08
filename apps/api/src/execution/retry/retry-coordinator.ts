import type { StageIssue } from "@/pipeline/contracts/stage-result";

/** One batch's retry history so far — carried forward across attempts. */
export interface RetryContext {
  readonly batchId: string;
  readonly attemptNumber: number;
  readonly lastError: StageIssue | null;
  readonly firstFailedAt: string;
}

/** One scheduled retry attempt, recorded for observability. */
export interface RetryMetadata {
  readonly batchId: string;
  readonly attemptNumber: number;
  readonly scheduledAt: string;
  readonly reason: string;
}

export interface RetryReport {
  readonly totalRetries: number;
  readonly succeededAfterRetry: number;
  readonly exhausted: readonly string[];
}

/**
 * Given a batch's retry history, should it be retried? No concrete policy
 * exists this volume ("Do NOT implement retry policy yet" / "NO Retry
 * Algorithms" — those belong to a future volume). `NEVER_RETRY` is the only
 * implementation wired in by default, which is why `ExecutionState.Retrying`
 * is a legal state in the machine but never actually entered today: nothing
 * ever asks the coordinator to retry anything. Swapping in a real policy
 * later touches only `RetryCoordinator`'s constructor argument.
 */
export type RetryPolicy = (context: RetryContext) => boolean;

export const NEVER_RETRY: RetryPolicy = () => false;

/** FIFO queue of pending retry attempts. */
export class RetryQueue {
  private readonly entries: RetryContext[] = [];

  enqueue(context: RetryContext): void {
    this.entries.push(context);
  }

  dequeue(): RetryContext | undefined {
    return this.entries.shift();
  }

  get size(): number {
    return this.entries.length;
  }

  peekAll(): readonly RetryContext[] {
    return [...this.entries];
  }
}

/**
 * The architecture a future retry engine plugs into: a queue, per-attempt
 * metadata, and a report builder. `recordFailure` always builds and returns
 * a `RetryContext` (so a caller always knows the current attempt number),
 * but only enqueues it — and only records `RetryMetadata` — when `policy`
 * says to retry. With the default `NEVER_RETRY` policy, every failure is
 * recorded but nothing is ever queued.
 */
export class RetryCoordinator {
  private readonly queue = new RetryQueue();
  private readonly metadata: RetryMetadata[] = [];
  private readonly succeededBatchIds = new Set<string>();

  constructor(private readonly policy: RetryPolicy = NEVER_RETRY) {}

  recordFailure(
    batchId: string,
    error: StageIssue | null,
    previousAttempt?: RetryContext,
  ): RetryContext {
    const context: RetryContext = {
      batchId,
      attemptNumber: (previousAttempt?.attemptNumber ?? 0) + 1,
      lastError: error,
      firstFailedAt: previousAttempt?.firstFailedAt ?? new Date().toISOString(),
    };

    if (this.policy(context)) {
      this.queue.enqueue(context);
      this.metadata.push({
        batchId,
        attemptNumber: context.attemptNumber,
        scheduledAt: new Date().toISOString(),
        reason: error?.message ?? "unknown failure",
      });
    }

    return context;
  }

  recordSuccessAfterRetry(batchId: string): void {
    this.succeededBatchIds.add(batchId);
  }

  nextRetry(): RetryContext | undefined {
    return this.queue.dequeue();
  }

  get pendingCount(): number {
    return this.queue.size;
  }

  buildReport(exhaustedBatchIds: readonly string[] = []): RetryReport {
    return {
      totalRetries: this.metadata.length,
      succeededAfterRetry: this.succeededBatchIds.size,
      exhausted: exhaustedBatchIds,
    };
  }
}
