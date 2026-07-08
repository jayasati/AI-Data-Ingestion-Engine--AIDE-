import { describe, expect, it, vi } from "vitest";
import {
  CancellationRequestedError,
  CancellationToken,
} from "@/execution/cancellation/cancellation-token";

describe("CancellationToken", () => {
  it("starts out not cancelled", () => {
    const token = new CancellationToken();
    expect(token.isCancelled).toBe(false);
    expect(token.cancellationReason).toBeNull();
  });

  it("becomes cancelled, carrying the given reason", () => {
    const token = new CancellationToken();
    token.cancel("user requested");
    expect(token.isCancelled).toBe(true);
    expect(token.cancellationReason).toBe("user requested");
  });

  it("is idempotent — the first cancel() call wins", () => {
    const token = new CancellationToken();
    token.cancel("first");
    token.cancel("second");
    expect(token.cancellationReason).toBe("first");
  });

  it("notifies listeners synchronously when cancelled", () => {
    const token = new CancellationToken();
    const listener = vi.fn();
    token.onCancelled(listener);
    token.cancel("stopped");
    expect(listener).toHaveBeenCalledWith("stopped");
  });

  it("fires a listener registered after cancellation immediately, with the existing reason", () => {
    const token = new CancellationToken();
    token.cancel("already gone");
    const listener = vi.fn();
    token.onCancelled(listener);
    expect(listener).toHaveBeenCalledWith("already gone");
  });

  it("unsubscribe stops future notifications", () => {
    const token = new CancellationToken();
    const listener = vi.fn();
    const unsubscribe = token.onCancelled(listener);
    unsubscribe();
    token.cancel();
    expect(listener).not.toHaveBeenCalled();
  });

  it("throwIfCancelled is a no-op before cancellation", () => {
    const token = new CancellationToken();
    expect(() => token.throwIfCancelled()).not.toThrow();
  });

  it("throwIfCancelled throws CancellationRequestedError after cancellation", () => {
    const token = new CancellationToken();
    token.cancel("done");
    expect(() => token.throwIfCancelled()).toThrow(CancellationRequestedError);
  });
});
