export type CancellationListener = (reason: string | null) => void;

/**
 * Cooperative cancellation, same pattern as .NET's `CancellationToken` or
 * the DOM's `AbortSignal`: nothing here forcibly kills a worker mid-batch —
 * `WorkerPool` checks `isCancelled` between batches and simply stops
 * dispatching new ones, letting any in-flight batch finish ("Graceful
 * Worker Termination"). One token is created per execution and threaded
 * through the Worker Pool and every Worker it spawns.
 */
export class CancellationToken {
  private cancelled = false;
  private reason: string | null = null;
  private readonly listeners = new Set<CancellationListener>();

  get isCancelled(): boolean {
    return this.cancelled;
  }

  get cancellationReason(): string | null {
    return this.reason;
  }

  cancel(reason: string | null = null): void {
    if (this.cancelled) {
      return;
    }
    this.cancelled = true;
    this.reason = reason;
    for (const listener of this.listeners) {
      listener(reason);
    }
  }

  /** Registers a callback fired once, at the moment `cancel()` is called. Returns an unsubscribe function. */
  onCancelled(listener: CancellationListener): () => void {
    if (this.cancelled) {
      listener(this.reason);
      return () => {};
    }
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  throwIfCancelled(): void {
    if (this.cancelled) {
      throw new CancellationRequestedError(this.reason);
    }
  }
}

/** Thrown by `throwIfCancelled()` — a cooperative checkpoint, not used to forcibly interrupt anything already running. */
export class CancellationRequestedError extends Error {
  constructor(readonly reason: string | null) {
    super(`Execution was cancelled${reason ? `: ${reason}` : "."}`);
    this.name = "CancellationRequestedError";
  }
}
