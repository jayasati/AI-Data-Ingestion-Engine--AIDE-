import { describe, expect, it } from "vitest";
import { buildDatasetSummary } from "@/trust/reports/validation-report";
import type { ValidatedRecord } from "@/pipeline/domain/validation";

function record(overrides: Partial<ValidatedRecord>): ValidatedRecord {
  return {
    rowNumber: 1,
    isValid: true,
    confidenceScore: 1,
    issues: [],
    approvalStatus: "approved",
    approvalReason: "",
    qualityScore: 100,
    skipped: false,
    skipReason: null,
    repairCount: 0,
    repairsApplied: [],
    fields: [],
    classifiedIssues: [],
    ...overrides,
  };
}

describe("buildDatasetSummary", () => {
  it("returns all-zero for an empty dataset", () => {
    const summary = buildDatasetSummary([]);
    expect(summary.totalRecords).toBe(0);
    expect(summary.averageConfidence).toBe(0);
    expect(summary.averageQualityScore).toBe(0);
  });

  it("counts records by approval status", () => {
    const summary = buildDatasetSummary([
      record({ approvalStatus: "approved" }),
      record({ approvalStatus: "approved" }),
      record({ approvalStatus: "needs_review" }),
      record({ approvalStatus: "rejected" }),
      record({ approvalStatus: "skipped" }),
    ]);
    expect(summary.totalRecords).toBe(5);
    expect(summary.approvedCount).toBe(2);
    expect(summary.needsReviewCount).toBe(1);
    expect(summary.rejectedCount).toBe(1);
    expect(summary.skippedCount).toBe(1);
  });

  it("averages confidence and quality score across records", () => {
    const summary = buildDatasetSummary([
      record({ confidenceScore: 1, qualityScore: 100 }),
      record({ confidenceScore: 0, qualityScore: 0 }),
    ]);
    expect(summary.averageConfidence).toBe(0.5);
    expect(summary.averageQualityScore).toBe(50);
  });

  it("sums total repairs and counts records that needed at least one", () => {
    const summary = buildDatasetSummary([
      record({ repairCount: 2 }),
      record({ repairCount: 0 }),
      record({ repairCount: 3 }),
    ]);
    expect(summary.totalRepairs).toBe(5);
    expect(summary.recordsWithRepairs).toBe(2);
  });
});
