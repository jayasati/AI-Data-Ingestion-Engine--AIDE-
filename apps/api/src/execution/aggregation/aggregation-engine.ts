import type { DatasetValidationSummary } from "@/pipeline/domain/validation";
import type { BatchExecutionResult, ExecutionBatch } from "@/execution/batch/batch-model";
import type { ExecutionContext } from "@/execution/context/execution-context";
import type { ExecutionMetrics } from "@/execution/metrics/execution-metrics";
import type { ImportResult } from "@/execution/aggregation/import-result";

/** Weighted (by each batch's own record count) merge — a 5-record batch doesn't skew the average as much as a 500-record one. */
function mergeDatasetSummaries(
  summaries: readonly DatasetValidationSummary[],
): DatasetValidationSummary {
  const totalRecords = summaries.reduce((sum, s) => sum + s.totalRecords, 0);
  const weightedAverage = (pick: (s: DatasetValidationSummary) => number): number =>
    totalRecords > 0
      ? summaries.reduce((sum, s) => sum + pick(s) * s.totalRecords, 0) / totalRecords
      : 0;

  return {
    totalRecords,
    approvedCount: summaries.reduce((sum, s) => sum + s.approvedCount, 0),
    needsReviewCount: summaries.reduce((sum, s) => sum + s.needsReviewCount, 0),
    rejectedCount: summaries.reduce((sum, s) => sum + s.rejectedCount, 0),
    skippedCount: summaries.reduce((sum, s) => sum + s.skippedCount, 0),
    averageConfidence: weightedAverage((s) => s.averageConfidence),
    averageQualityScore: weightedAverage((s) => s.averageQualityScore),
    totalRepairs: summaries.reduce((sum, s) => sum + s.totalRepairs, 0),
    recordsWithRepairs: summaries.reduce((sum, s) => sum + s.recordsWithRepairs, 0),
  };
}

/**
 * The Execution Platform's own Aggregation Engine — collects every batch's
 * Trust Layer output into one final `ImportResult`. Only *successful*
 * batches ever contribute approved/needs-review/rejected/skipped records;
 * a failed batch contributes to `failedBatches` and to `warnings`/`errors`
 * only, so a handful of failures never discards the records every other
 * batch already validated ("Never discard successful work" / partial
 * success). Distinct from the still-placeholder `AggregationStage`
 * (`pipeline/stages/aggregation`), which folds one batch's own
 * `ValidationResult` into an `ImportSummary` — a per-batch, business-facing
 * concern this engine deliberately doesn't touch.
 */
export function aggregateResults(
  context: ExecutionContext,
  batches: readonly ExecutionBatch[],
  batchResults: readonly BatchExecutionResult[],
  metrics: ExecutionMetrics,
  completedAt: Date = new Date(),
): ImportResult {
  const succeeded = batchResults.filter((result) => result.status === "completed");
  const failed = batchResults.filter((result) => result.status !== "completed");

  const records = succeeded.flatMap((result) => result.validation?.records ?? []);
  const approvedRecords = records.filter((r) => r.approvalStatus === "approved");
  const needsReviewRecords = records.filter((r) => r.approvalStatus === "needs_review");
  const rejectedRecords = records.filter((r) => r.approvalStatus === "rejected");
  const skippedRecords = records.filter((r) => r.approvalStatus === "skipped");

  const summaries = succeeded
    .map((result) => result.validation?.summary)
    .filter((summary): summary is DatasetValidationSummary => summary !== undefined);
  const datasetSummary = summaries.length > 0 ? mergeDatasetSummaries(summaries) : null;

  const warnings = [...context.warnings, ...batchResults.flatMap((result) => result.warnings)];
  const errors = [...context.errors, ...batchResults.flatMap((result) => result.errors)];

  const startedAtMs = new Date(context.startedAt).getTime();

  return {
    importId: context.importId,
    executionId: context.executionId,
    finalState: context.currentState,
    approvedRecords,
    needsReviewRecords,
    rejectedRecords,
    skippedRecords,
    totalBatches: batches.length,
    succeededBatches: succeeded.length,
    failedBatches: failed,
    allBatches: batchResults,
    datasetSummary,
    metrics,
    warnings,
    errors,
    startedAt: context.startedAt,
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAtMs,
  };
}
