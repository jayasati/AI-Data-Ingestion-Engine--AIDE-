import { describe, expect, it } from "vitest";
import { NEVER_RETRY, RetryCoordinator, RetryQueue } from "@/execution/retry/retry-coordinator";

describe("RetryQueue", () => {
  it("dequeues in FIFO order", () => {
    const queue = new RetryQueue();
    queue.enqueue({ batchId: "b1", attemptNumber: 1, lastError: null, firstFailedAt: "t" });
    queue.enqueue({ batchId: "b2", attemptNumber: 1, lastError: null, firstFailedAt: "t" });
    expect(queue.dequeue()?.batchId).toBe("b1");
    expect(queue.dequeue()?.batchId).toBe("b2");
  });

  it("reports size and returns undefined when empty", () => {
    const queue = new RetryQueue();
    expect(queue.size).toBe(0);
    expect(queue.dequeue()).toBeUndefined();
  });
});

describe("RetryCoordinator with the default NEVER_RETRY policy", () => {
  it("records the failure and returns a RetryContext, but never enqueues it", () => {
    const coordinator = new RetryCoordinator();
    const context = coordinator.recordFailure("batch-1", { code: "E", message: "boom" });

    expect(context.batchId).toBe("batch-1");
    expect(context.attemptNumber).toBe(1);
    expect(coordinator.pendingCount).toBe(0);
  });

  it("produces a report with zero retries when nothing was ever queued", () => {
    const coordinator = new RetryCoordinator();
    coordinator.recordFailure("batch-1", { code: "E", message: "boom" });
    const report = coordinator.buildReport();
    expect(report.totalRetries).toBe(0);
  });
});

describe("RetryCoordinator with a custom policy", () => {
  it("enqueues and records metadata when the policy says to retry", () => {
    const alwaysRetryOnce: (ctx: { attemptNumber: number }) => boolean = (ctx) =>
      ctx.attemptNumber <= 1;
    const coordinator = new RetryCoordinator(alwaysRetryOnce);

    coordinator.recordFailure("batch-1", { code: "E", message: "boom" });

    expect(coordinator.pendingCount).toBe(1);
    const next = coordinator.nextRetry();
    expect(next?.batchId).toBe("batch-1");
    expect(coordinator.pendingCount).toBe(0);
  });

  it("increments attemptNumber across repeated failures of the same batch", () => {
    const coordinator = new RetryCoordinator(() => true);
    const first = coordinator.recordFailure("batch-1", { code: "E", message: "one" });
    const second = coordinator.recordFailure("batch-1", { code: "E", message: "two" }, first);

    expect(first.attemptNumber).toBe(1);
    expect(second.attemptNumber).toBe(2);
    expect(second.firstFailedAt).toBe(first.firstFailedAt);
  });

  it("counts totalRetries and succeededAfterRetry in the report", () => {
    const coordinator = new RetryCoordinator(() => true);
    coordinator.recordFailure("batch-1", { code: "E", message: "boom" });
    coordinator.recordFailure("batch-2", { code: "E", message: "boom" });
    coordinator.recordSuccessAfterRetry("batch-1");

    const report = coordinator.buildReport(["batch-2"]);
    expect(report.totalRetries).toBe(2);
    expect(report.succeededAfterRetry).toBe(1);
    expect(report.exhausted).toEqual(["batch-2"]);
  });
});

describe("NEVER_RETRY", () => {
  it("always returns false", () => {
    expect(
      NEVER_RETRY({ batchId: "x", attemptNumber: 99, lastError: null, firstFailedAt: "t" }),
    ).toBe(false);
  });
});
