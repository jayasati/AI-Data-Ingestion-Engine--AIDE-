import { ExecutionTimeoutError } from "@/execution/errors/execution-errors";

export interface TimeoutRecord {
  readonly label: string;
  readonly timeoutMs: number;
  readonly timedOut: boolean;
  readonly durationMs: number;
}

export interface TimeoutReport {
  readonly records: readonly TimeoutRecord[];
  readonly timedOutCount: number;
}

/**
 * Races `promise` against `timeoutMs`; throws `ExecutionTimeoutError` if the
 * timeout wins, otherwise resolves/rejects exactly as `promise` would have.
 * Always clears its timer in a `finally`, so a resolved promise never
 * leaves a dangling `setTimeout` behind.
 */
export function runWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new ExecutionTimeoutError(label, timeoutMs)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Accumulates a `TimeoutReport` across every `track()` call — the
 * Execution Engine wraps each configurable ceiling (batch, AI request,
 * validation, aggregation, whole-execution) through one shared tracker so
 * the final report covers every timeout surface, not just one.
 */
export class TimeoutTracker {
  private readonly records: TimeoutRecord[] = [];

  async track<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    const startedAt = Date.now();
    try {
      const result = await runWithTimeout(promise, timeoutMs, label);
      this.records.push({ label, timeoutMs, timedOut: false, durationMs: Date.now() - startedAt });
      return result;
    } catch (error) {
      const timedOut = error instanceof ExecutionTimeoutError;
      this.records.push({ label, timeoutMs, timedOut, durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  buildReport(): TimeoutReport {
    return {
      records: [...this.records],
      timedOutCount: this.records.filter((record) => record.timedOut).length,
    };
  }
}
