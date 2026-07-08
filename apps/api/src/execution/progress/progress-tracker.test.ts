import { describe, expect, it } from "vitest";
import { computeProgress } from "@/execution/progress/progress-tracker";
import { ExecutionContext } from "@/execution/context/execution-context";

/** `startedAt` is fixed at creation (`ExecutionContext.create()`), so tests pass a `now` explicitly ahead of it to get a meaningful elapsed time. */
function freshContext(): ExecutionContext {
  return ExecutionContext.create("import-1", "exec-1");
}

describe("computeProgress", () => {
  it("reports 0% and no ETA before anything has completed", () => {
    const context = freshContext();
    const snapshot = computeProgress(context, 100, 0, new Date(Date.now() + 1000));
    expect(snapshot.percentage).toBe(0);
    expect(snapshot.estimatedRemainingMs).toBeNull();
    expect(snapshot.remainingRecords).toBe(100);
  });

  it("reports 100% when every record is completed", () => {
    const context = freshContext();
    const snapshot = computeProgress(context, 100, 100, new Date(Date.now() + 1000));
    expect(snapshot.percentage).toBe(100);
    expect(snapshot.remainingRecords).toBe(0);
  });

  it("reports 50% at the halfway point", () => {
    const context = freshContext();
    const snapshot = computeProgress(context, 100, 50, new Date(Date.now() + 1000));
    expect(snapshot.percentage).toBe(50);
  });

  it("computes a positive throughput once time has elapsed and records completed", () => {
    const context = freshContext();
    const now = new Date(Date.now() + 2000);
    const snapshot = computeProgress(context, 100, 20, now);
    expect(snapshot.throughputRecordsPerSecond).toBeGreaterThan(0);
    expect(snapshot.estimatedRemainingMs).not.toBeNull();
  });

  it("treats zero total records as 0% rather than dividing by zero", () => {
    const context = freshContext();
    const snapshot = computeProgress(context, 0, 0, new Date());
    expect(snapshot.percentage).toBe(0);
    expect(Number.isFinite(snapshot.percentage)).toBe(true);
  });

  it("carries the context's currentStage and currentBatchId through", () => {
    const context = freshContext().withCurrentStage("normalization").withCurrentBatch("b1");
    const snapshot = computeProgress(context, 10, 0, new Date());
    expect(snapshot.currentStage).toBe("normalization");
    expect(snapshot.currentBatchId).toBe("b1");
  });

  it("never reports negative elapsed time even if `now` predates startedAt", () => {
    const context = freshContext();
    const past = new Date(Date.now() - 10_000);
    const snapshot = computeProgress(context, 10, 0, past);
    expect(snapshot.elapsedMs).toBeGreaterThanOrEqual(0);
  });
});
