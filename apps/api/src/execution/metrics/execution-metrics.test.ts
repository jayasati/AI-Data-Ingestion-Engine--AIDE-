import { describe, expect, it } from "vitest";
import { computeExecutionMetrics } from "@/execution/metrics/execution-metrics";
import type { BatchExecutionResult } from "@/execution/batch/batch-model";
import type { AIExecutionReport } from "@/ai/contracts/execution";

function aiReport(latencyMs: number, estimatedCostUsd: number | null): AIExecutionReport {
  return {
    requestId: "req-1",
    provider: "mock",
    model: "mock-v1",
    promptVersion: "v1",
    schemaVersion: "v1",
    startedAt: "t0",
    completedAt: "t1",
    latencyMs,
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    estimatedCostUsd,
    status: "success",
    warnings: [],
    parserDiagnostics: [],
    promptMetadata: null,
    repairMetadata: { attempted: false, succeeded: false, repairsApplied: [] },
  };
}

function batchResult(overrides: Partial<BatchExecutionResult> = {}): BatchExecutionResult {
  return {
    batchId: "batch-1",
    sequenceNumber: 1,
    status: "completed",
    validation: null,
    aiReport: null,
    normalizationReport: null,
    warnings: [],
    errors: [],
    timing: { startedAt: "t0", completedAt: "t1", durationMs: 100 },
    statistics: { recordCount: 10 },
    ...overrides,
  };
}

describe("computeExecutionMetrics", () => {
  it("sums total and completed records across every completed batch", () => {
    const metrics = computeExecutionMetrics(
      [
        batchResult({ statistics: { recordCount: 10 } }),
        batchResult({ statistics: { recordCount: 5 } }),
      ],
      2,
      1000,
    );
    expect(metrics.totalRecords).toBe(15);
    expect(metrics.completedRecords).toBe(15);
    expect(metrics.failedRecords).toBe(0);
  });

  it("excludes failed batches' records from completedRecords, includes them in failedRecords", () => {
    const metrics = computeExecutionMetrics(
      [
        batchResult({ status: "completed", statistics: { recordCount: 10 } }),
        batchResult({ status: "failed", statistics: { recordCount: 5 } }),
      ],
      2,
      1000,
    );
    expect(metrics.totalRecords).toBe(15);
    expect(metrics.completedRecords).toBe(10);
    expect(metrics.failedRecords).toBe(5);
  });

  it("averages batch duration across all batches", () => {
    const metrics = computeExecutionMetrics(
      [
        batchResult({ timing: { startedAt: "t0", completedAt: "t1", durationMs: 100 } }),
        batchResult({ timing: { startedAt: "t0", completedAt: "t1", durationMs: 300 } }),
      ],
      2,
      1000,
    );
    expect(metrics.averageBatchTimeMs).toBe(200);
  });

  it("averages AI latency only over batches that carry an aiReport", () => {
    const metrics = computeExecutionMetrics(
      [
        batchResult({ aiReport: aiReport(200, 0.01) }),
        batchResult({ aiReport: aiReport(400, 0.02) }),
        batchResult({ aiReport: null }),
      ],
      2,
      1000,
    );
    expect(metrics.averageAiTimeMs).toBe(300);
  });

  it("sums estimated cost across batches that carry one, null when none do", () => {
    const withCosts = computeExecutionMetrics(
      [
        batchResult({ aiReport: aiReport(100, 0.01) }),
        batchResult({ aiReport: aiReport(100, 0.02) }),
      ],
      2,
      1000,
    );
    expect(withCosts.estimatedCostUsd).toBeCloseTo(0.03);

    const withoutCosts = computeExecutionMetrics(
      [batchResult({ aiReport: aiReport(100, null) })],
      2,
      1000,
    );
    expect(withoutCosts.estimatedCostUsd).toBeNull();
  });

  it("computes worker utilization as busy time over total capacity", () => {
    // 2 batches x 100ms busy = 200ms busy; 2 workers x 1000ms execution = 2000ms capacity -> 0.1
    const metrics = computeExecutionMetrics(
      [
        batchResult({ timing: { startedAt: "t0", completedAt: "t1", durationMs: 100 } }),
        batchResult({ timing: { startedAt: "t0", completedAt: "t1", durationMs: 100 } }),
      ],
      2,
      1000,
    );
    expect(metrics.workerUtilization).toBeCloseTo(0.1);
  });

  it("computes a positive throughput when records completed over positive execution time", () => {
    const metrics = computeExecutionMetrics(
      [batchResult({ statistics: { recordCount: 10 } })],
      1,
      1000,
    );
    expect(metrics.throughputRecordsPerSecond).toBeGreaterThan(0);
  });

  it("leaves memoryUsageBytes as the documented placeholder", () => {
    const metrics = computeExecutionMetrics([], 1, 1000);
    expect(metrics.memoryUsageBytes).toBeNull();
  });

  it("handles an empty batch list without dividing by zero", () => {
    const metrics = computeExecutionMetrics([], 2, 0);
    expect(metrics.totalRecords).toBe(0);
    expect(metrics.workerUtilization).toBe(0);
    expect(metrics.throughputRecordsPerSecond).toBe(0);
  });
});
