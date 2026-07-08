import { describe, expect, it } from "vitest";
import { ExecutionContext } from "@/execution/context/execution-context";
import { ExecutionState } from "@/execution/state/execution-state";
import { DEFAULT_EXECUTION_CONFIG } from "@/execution/config/execution-config";
import { IllegalExecutionStateTransitionError } from "@/execution/errors/execution-errors";

describe("ExecutionContext", () => {
  it("creates with ExecutionState.Created and empty collections", () => {
    const context = ExecutionContext.create("import-1", "exec-1");
    expect(context.currentState).toBe(ExecutionState.Created);
    expect(context.completedBatchIds).toEqual([]);
    expect(context.runningWorkers).toEqual([]);
    expect(context.warnings).toEqual([]);
    expect(context.errors).toEqual([]);
    expect(context.cancellationRequested).toBe(false);
    expect(context.configuration).toBe(DEFAULT_EXECUTION_CONFIG);
  });

  it("never mutates the original instance", () => {
    const original = ExecutionContext.create("import-1", "exec-1");
    const next = original.transitionTo(ExecutionState.Queued);
    expect(original.currentState).toBe(ExecutionState.Created);
    expect(next.currentState).toBe(ExecutionState.Queued);
    expect(next).not.toBe(original);
  });

  it("transitionTo throws on an illegal edge", () => {
    const context = ExecutionContext.create("import-1", "exec-1");
    expect(() => context.transitionTo(ExecutionState.Completed)).toThrow(
      IllegalExecutionStateTransitionError,
    );
  });

  it("tracks the current stage and current batch independently", () => {
    const context = ExecutionContext.create("import-1", "exec-1")
      .withCurrentStage("normalization")
      .withCurrentBatch("batch-1");
    expect(context.currentStage).toBe("normalization");
    expect(context.currentBatchId).toBe("batch-1");
  });

  it("appends completed batches without losing prior ones", () => {
    const context = ExecutionContext.create("import-1", "exec-1")
      .completeBatch("batch-1")
      .completeBatch("batch-2");
    expect(context.completedBatchIds).toEqual(["batch-1", "batch-2"]);
  });

  it("merges metrics additively", () => {
    const context = ExecutionContext.create("import-1", "exec-1")
      .mergeMetrics({ completedRecords: 10 })
      .mergeMetrics({ failedRecords: 2 });
    expect(context.metrics).toEqual({ completedRecords: 10, failedRecords: 2 });
  });

  it("overwrites a metric key on a later merge", () => {
    const context = ExecutionContext.create("import-1", "exec-1")
      .mergeMetrics({ completedRecords: 10 })
      .mergeMetrics({ completedRecords: 20 });
    expect(context.metrics.completedRecords).toBe(20);
  });

  it("accumulates warnings and errors across calls", () => {
    const context = ExecutionContext.create("import-1", "exec-1")
      .addWarnings([{ code: "W1", message: "warn" }])
      .addErrors([{ code: "E1", message: "err" }]);
    expect(context.warnings).toHaveLength(1);
    expect(context.errors).toHaveLength(1);
  });

  it("is a no-op (same warnings array) when adding an empty list", () => {
    const context = ExecutionContext.create("import-1", "exec-1");
    const next = context.addWarnings([]);
    expect(next).toBe(context);
  });

  it("records cancellation state and reason", () => {
    const context = ExecutionContext.create("import-1", "exec-1").requestCancellation(
      "user requested",
    );
    expect(context.cancellationRequested).toBe(true);
    expect(context.cancellationReason).toBe("user requested");
  });

  it("stores arbitrary metadata without clobbering existing keys", () => {
    const context = ExecutionContext.create("import-1", "exec-1")
      .withMetadata("a", 1)
      .withMetadata("b", 2);
    expect(context.metadata).toEqual({ a: 1, b: 2 });
  });
});
