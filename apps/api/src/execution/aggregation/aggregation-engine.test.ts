import { describe, expect, it } from "vitest";
import { aggregateResults } from "@/execution/aggregation/aggregation-engine";
import { ExecutionContext } from "@/execution/context/execution-context";
import type { BatchExecutionResult, ExecutionBatch } from "@/execution/batch/batch-model";
import type { ExecutionMetrics } from "@/execution/metrics/execution-metrics";
import type { ApprovalStatus, ValidatedRecord } from "@/pipeline/domain/validation";
import type { ParsedDataset, ParsedRow } from "@/pipeline/domain/parsing";

function row(rowNumber: number): ParsedRow {
  return { rowNumber, rawCells: ["x"], cells: ["x"], status: "ok", warnings: [], context: {} };
}

function makeBatch(sequenceNumber: number): ExecutionBatch {
  const parsedDataset: ParsedDataset = {
    headers: ["Col"],
    rows: [row(sequenceNumber)],
    delimiter: ",",
    encoding: "utf-8",
    rowCount: 1,
    columnCount: 1,
    headerDuplicateFlags: [false],
  };
  return {
    batchId: `batch-${sequenceNumber}`,
    importId: "import-1",
    sequenceNumber,
    parsedDataset,
    recordCount: 1,
    metadata: {},
    estimatedTokens: null,
    estimatedCostUsd: null,
    dependsOn: [],
  };
}

function record(rowNumber: number, status: ApprovalStatus): ValidatedRecord {
  return {
    rowNumber,
    isValid: status !== "rejected",
    confidenceScore: 0.9,
    issues: [],
    approvalStatus: status,
    approvalReason: "",
    qualityScore: 80,
    skipped: status === "skipped",
    skipReason: status === "skipped" ? "no contact info" : null,
    repairCount: 0,
    repairsApplied: [],
    fields: [],
    classifiedIssues: [],
  };
}

function completedBatchResult(
  batchId: string,
  sequenceNumber: number,
  records: readonly ValidatedRecord[],
): BatchExecutionResult {
  return {
    batchId,
    sequenceNumber,
    status: "completed",
    validation: {
      records,
      summary: {
        totalRecords: records.length,
        approvedCount: records.filter((r) => r.approvalStatus === "approved").length,
        needsReviewCount: records.filter((r) => r.approvalStatus === "needs_review").length,
        rejectedCount: records.filter((r) => r.approvalStatus === "rejected").length,
        skippedCount: records.filter((r) => r.approvalStatus === "skipped").length,
        averageConfidence: 0.9,
        averageQualityScore: 80,
        totalRepairs: 0,
        recordsWithRepairs: 0,
      },
    },
    aiReport: null,
    normalizationReport: null,
    warnings: [],
    errors: [],
    timing: { startedAt: "t0", completedAt: "t1", durationMs: 100 },
    statistics: { recordCount: records.length },
  };
}

function failedBatchResult(batchId: string, sequenceNumber: number): BatchExecutionResult {
  return {
    batchId,
    sequenceNumber,
    status: "failed",
    validation: null,
    aiReport: null,
    normalizationReport: null,
    warnings: [],
    errors: [{ code: "BATCH_STAGE_FAILED", message: "boom" }],
    timing: { startedAt: "t0", completedAt: "t1", durationMs: 50 },
    statistics: { recordCount: 1 },
  };
}

const METRICS: ExecutionMetrics = {
  totalRecords: 0,
  completedRecords: 0,
  failedRecords: 0,
  workerUtilization: 0,
  averageBatchTimeMs: 0,
  averageAiTimeMs: 0,
  executionTimeMs: 1000,
  estimatedCostUsd: null,
  throughputRecordsPerSecond: 0,
  memoryUsageBytes: null,
};

describe("aggregateResults", () => {
  it("groups records by approval status across every successful batch", () => {
    const context = ExecutionContext.create("import-1", "exec-1");
    const batches = [makeBatch(1), makeBatch(2)];
    const results = [
      completedBatchResult("batch-1", 1, [record(1, "approved"), record(2, "needs_review")]),
      completedBatchResult("batch-2", 2, [record(3, "rejected"), record(4, "skipped")]),
    ];

    const importResult = aggregateResults(context, batches, results, METRICS);

    expect(importResult.approvedRecords).toHaveLength(1);
    expect(importResult.needsReviewRecords).toHaveLength(1);
    expect(importResult.rejectedRecords).toHaveLength(1);
    expect(importResult.skippedRecords).toHaveLength(1);
  });

  it("never discards successful batches' records when other batches fail (partial success)", () => {
    const context = ExecutionContext.create("import-1", "exec-1");
    const batches = [makeBatch(1), makeBatch(2), makeBatch(3)];
    const results = [
      completedBatchResult("batch-1", 1, [record(1, "approved")]),
      failedBatchResult("batch-2", 2),
      completedBatchResult("batch-3", 3, [record(3, "approved")]),
    ];

    const importResult = aggregateResults(context, batches, results, METRICS);

    expect(importResult.approvedRecords).toHaveLength(2);
    expect(importResult.succeededBatches).toBe(2);
    expect(importResult.failedBatches).toHaveLength(1);
    expect(importResult.failedBatches[0].batchId).toBe("batch-2");
  });

  it("reports totalBatches from the scheduled batch list, not just the results that succeeded", () => {
    const context = ExecutionContext.create("import-1", "exec-1");
    const batches = [makeBatch(1), makeBatch(2)];
    const results = [failedBatchResult("batch-1", 1), failedBatchResult("batch-2", 2)];

    const importResult = aggregateResults(context, batches, results, METRICS);

    expect(importResult.totalBatches).toBe(2);
    expect(importResult.succeededBatches).toBe(0);
    expect(importResult.approvedRecords).toEqual([]);
  });

  it("returns a null datasetSummary when zero batches succeeded", () => {
    const context = ExecutionContext.create("import-1", "exec-1");
    const importResult = aggregateResults(
      context,
      [makeBatch(1)],
      [failedBatchResult("batch-1", 1)],
      METRICS,
    );
    expect(importResult.datasetSummary).toBeNull();
  });

  it("merges dataset summaries weighted by each batch's record count", () => {
    const context = ExecutionContext.create("import-1", "exec-1");
    const batches = [makeBatch(1), makeBatch(2)];
    const results = [
      completedBatchResult("batch-1", 1, [record(1, "approved")]),
      completedBatchResult("batch-2", 2, [
        record(2, "approved"),
        record(3, "approved"),
        record(4, "approved"),
      ]),
    ];

    const importResult = aggregateResults(context, batches, results, METRICS);

    expect(importResult.datasetSummary?.totalRecords).toBe(4);
    expect(importResult.datasetSummary?.approvedCount).toBe(4);
  });

  it("collects batch-level errors into the top-level errors list", () => {
    const context = ExecutionContext.create("import-1", "exec-1");
    const importResult = aggregateResults(
      context,
      [makeBatch(1)],
      [failedBatchResult("batch-1", 1)],
      METRICS,
    );
    expect(importResult.errors).toContainEqual({ code: "BATCH_STAGE_FAILED", message: "boom" });
  });

  it("carries through the execution metrics unchanged", () => {
    const context = ExecutionContext.create("import-1", "exec-1");
    const importResult = aggregateResults(context, [], [], METRICS);
    expect(importResult.metrics).toBe(METRICS);
  });

  it("exposes every batch's outcome, succeeded or not, via allBatches", () => {
    const context = ExecutionContext.create("import-1", "exec-1");
    const results = [
      completedBatchResult("batch-1", 1, [record(1, "approved")]),
      failedBatchResult("batch-2", 2),
    ];
    const importResult = aggregateResults(context, [makeBatch(1), makeBatch(2)], results, METRICS);
    expect(importResult.allBatches).toHaveLength(2);
    expect(importResult.allBatches.map((b) => b.batchId)).toEqual(["batch-1", "batch-2"]);
  });

  it("computes a non-negative durationMs", () => {
    const context = ExecutionContext.create("import-1", "exec-1");
    const importResult = aggregateResults(context, [], [], METRICS, new Date(Date.now() + 500));
    expect(importResult.durationMs).toBeGreaterThanOrEqual(0);
  });
});
