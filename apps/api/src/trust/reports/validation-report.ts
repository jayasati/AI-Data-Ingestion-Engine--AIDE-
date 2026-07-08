import type { DatasetValidationSummary, ValidatedRecord } from "@/pipeline/domain/validation";

function average(values: readonly number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

/**
 * The "Per Dataset" tier of the Validation Report — a pure rollup over
 * already-computed `ValidatedRecord`s. Deliberately has no knowledge of how
 * any individual record was validated; it only aggregates what
 * `trust-engine.ts` already decided.
 */
export function buildDatasetSummary(records: readonly ValidatedRecord[]): DatasetValidationSummary {
  const totalRecords = records.length;
  const approvedCount = records.filter((r) => r.approvalStatus === "approved").length;
  const needsReviewCount = records.filter((r) => r.approvalStatus === "needs_review").length;
  const rejectedCount = records.filter((r) => r.approvalStatus === "rejected").length;
  const skippedCount = records.filter((r) => r.approvalStatus === "skipped").length;
  const recordsWithRepairs = records.filter((r) => r.repairCount > 0).length;
  const totalRepairs = records.reduce((sum, r) => sum + r.repairCount, 0);

  return {
    totalRecords,
    approvedCount,
    needsReviewCount,
    rejectedCount,
    skippedCount,
    averageConfidence: average(records.map((r) => r.confidenceScore)),
    averageQualityScore: average(records.map((r) => r.qualityScore)),
    totalRepairs,
    recordsWithRepairs,
  };
}
