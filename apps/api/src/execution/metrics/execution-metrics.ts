import type { BatchExecutionResult } from "@/execution/batch/batch-model";

export interface ExecutionMetrics {
  readonly totalRecords: number;
  readonly completedRecords: number;
  readonly failedRecords: number;
  /** 0-1: total worker-busy time divided by total worker-capacity time (`workerCount * executionTimeMs`). */
  readonly workerUtilization: number;
  readonly averageBatchTimeMs: number;
  readonly averageAiTimeMs: number;
  readonly executionTimeMs: number;
  /** Null when no batch carried a known cost (e.g. every batch used the Mock provider). */
  readonly estimatedCostUsd: number | null;
  readonly throughputRecordsPerSecond: number;
  /** Not implemented this volume — an explicit placeholder, per spec. */
  readonly memoryUsageBytes: null;
}

function average(values: readonly number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * A pure rollup over every batch's result — no side effects, no dependence
 * on `ExecutionContext` beyond what's passed in explicitly, so it can be
 * called at any point (mid-execution for a partial metrics snapshot, or
 * once at the end for the final `ExecutionReport`).
 */
export function computeExecutionMetrics(
  batchResults: readonly BatchExecutionResult[],
  workerCount: number,
  executionTimeMs: number,
): ExecutionMetrics {
  const completed = batchResults.filter((result) => result.status === "completed");
  const totalRecords = batchResults.reduce(
    (sum, result) => sum + (result.statistics.recordCount ?? 0),
    0,
  );
  const completedRecords = completed.reduce(
    (sum, result) => sum + (result.statistics.recordCount ?? 0),
    0,
  );
  const failedRecords = totalRecords - completedRecords;

  const batchDurations = batchResults.map((result) => result.timing.durationMs ?? 0);
  const averageBatchTimeMs = average(batchDurations);

  const aiDurations = batchResults
    .map((result) => result.aiReport?.latencyMs)
    .filter((value): value is number => typeof value === "number");
  const averageAiTimeMs = average(aiDurations);

  const totalBusyTimeMs = batchDurations.reduce((sum, duration) => sum + duration, 0);
  const workerCapacityMs = workerCount * executionTimeMs;
  const workerUtilization = workerCapacityMs > 0 ? clamp01(totalBusyTimeMs / workerCapacityMs) : 0;

  const costs = batchResults
    .map((result) => result.aiReport?.estimatedCostUsd)
    .filter((value): value is number => typeof value === "number");
  const estimatedCostUsd = costs.length > 0 ? costs.reduce((sum, cost) => sum + cost, 0) : null;

  const throughputRecordsPerSecond =
    executionTimeMs > 0 ? (completedRecords / executionTimeMs) * 1000 : 0;

  return {
    totalRecords,
    completedRecords,
    failedRecords,
    workerUtilization,
    averageBatchTimeMs,
    averageAiTimeMs,
    executionTimeMs,
    estimatedCostUsd,
    throughputRecordsPerSecond,
    memoryUsageBytes: null,
  };
}
