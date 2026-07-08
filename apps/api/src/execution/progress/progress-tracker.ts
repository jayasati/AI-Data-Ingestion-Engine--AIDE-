/**
 * The only three fields `computeProgress` actually needs — `ExecutionContext`
 * satisfies this structurally (so existing `ExecutionEngine`-internal
 * callers need no change), but a caller polling from outside the engine
 * (e.g. `ImportService`, which has no live `ExecutionContext` reference
 * between polls) can build one from whatever it tracked itself, typically
 * via `ExecutionEventBus` subscriptions.
 */
export interface ProgressSource {
  readonly startedAt: string;
  readonly currentStage: string | null;
  readonly currentBatchId: string | null;
}

export interface ProgressSnapshot {
  readonly currentStage: string | null;
  readonly currentBatchId: string | null;
  readonly completedRecords: number;
  readonly totalRecords: number;
  readonly remainingRecords: number;
  /** 0-100. */
  readonly percentage: number;
  readonly elapsedMs: number;
  /** Null until throughput is known (nothing completed yet). */
  readonly estimatedRemainingMs: number | null;
  readonly throughputRecordsPerSecond: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * A pure snapshot function, not a stateful tracker — called fresh whenever
 * a progress update is needed (after each batch completes, or on demand for
 * an HTTP poll), taking `now` as an explicit parameter so callers (and
 * tests) never depend on real wall-clock time. `completedRecords` counts
 * records from batches that have *finished* (successfully or not); a batch
 * still running contributes nothing until it completes.
 */
export function computeProgress(
  source: ProgressSource,
  totalRecords: number,
  completedRecords: number,
  now: Date = new Date(),
): ProgressSnapshot {
  const elapsedMs = Math.max(0, now.getTime() - new Date(source.startedAt).getTime());
  const remainingRecords = Math.max(0, totalRecords - completedRecords);
  const percentage = totalRecords > 0 ? clamp((completedRecords / totalRecords) * 100, 0, 100) : 0;
  const throughputRecordsPerSecond = elapsedMs > 0 ? (completedRecords / elapsedMs) * 1000 : 0;
  const estimatedRemainingMs =
    throughputRecordsPerSecond > 0 ? (remainingRecords / throughputRecordsPerSecond) * 1000 : null;

  return {
    currentStage: source.currentStage,
    currentBatchId: source.currentBatchId,
    completedRecords,
    totalRecords,
    remainingRecords,
    percentage,
    elapsedMs,
    estimatedRemainingMs,
    throughputRecordsPerSecond,
  };
}
