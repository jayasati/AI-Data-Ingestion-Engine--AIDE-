import { describe, expect, it } from "vitest";
import { runWithTimeout, TimeoutTracker } from "@/execution/timeout/timeout-manager";
import { ExecutionTimeoutError } from "@/execution/errors/execution-errors";

function delay<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

describe("runWithTimeout", () => {
  it("resolves with the promise's value when it finishes before the timeout", async () => {
    await expect(runWithTimeout(delay("ok", 5), 200, "fast")).resolves.toBe("ok");
  });

  it("rejects with ExecutionTimeoutError when the timeout wins", async () => {
    await expect(runWithTimeout(delay("too slow", 200), 10, "slow")).rejects.toThrow(
      ExecutionTimeoutError,
    );
  });

  it("propagates the original promise's rejection when it rejects before the timeout", async () => {
    const failing = Promise.reject(new Error("real failure"));
    await expect(runWithTimeout(failing, 200, "failing")).rejects.toThrow("real failure");
  });
});

describe("TimeoutTracker", () => {
  it("records a successful, non-timed-out entry", async () => {
    const tracker = new TimeoutTracker();
    await tracker.track(delay("ok", 5), 200, "step-1");
    const report = tracker.buildReport();
    expect(report.timedOutCount).toBe(0);
    expect(report.records[0].label).toBe("step-1");
    expect(report.records[0].timedOut).toBe(false);
  });

  it("records a timed-out entry and rethrows", async () => {
    const tracker = new TimeoutTracker();
    await expect(tracker.track(delay("slow", 200), 10, "step-2")).rejects.toThrow(
      ExecutionTimeoutError,
    );
    const report = tracker.buildReport();
    expect(report.timedOutCount).toBe(1);
    expect(report.records[0].timedOut).toBe(true);
  });

  it("accumulates records across multiple tracked operations", async () => {
    const tracker = new TimeoutTracker();
    await tracker.track(delay("a", 1), 200, "a");
    await tracker.track(delay("b", 1), 200, "b");
    expect(tracker.buildReport().records).toHaveLength(2);
  });
});
