import { ApplicationError } from "@/core/errors";

/** Mirrors `pipeline/errors/illegal-state-transition-error.ts` for the Execution Platform's own state machine. */
export class IllegalExecutionStateTransitionError extends ApplicationError {
  constructor(from: string, to: string) {
    super(
      `Illegal execution state transition from "${from}" to "${to}".`,
      "ILLEGAL_EXECUTION_STATE_TRANSITION",
      500,
      false,
      { from, to },
    );
  }
}

/** Thrown by `timeout/timeout-manager.ts` when a stage/batch/execution ceiling is exceeded. */
export class ExecutionTimeoutError extends ApplicationError {
  constructor(label: string, timeoutMs: number) {
    super(`"${label}" exceeded its ${timeoutMs}ms timeout.`, "EXECUTION_TIMEOUT", 504, true, {
      label,
      timeoutMs,
    });
  }
}

/** Thrown when a caller inspects a cancelled execution's result as though it completed normally. */
export class ExecutionCancelledError extends ApplicationError {
  constructor(executionId: string, reason: string | null) {
    super(
      `Execution "${executionId}" was cancelled${reason ? `: ${reason}` : "."}`,
      "EXECUTION_CANCELLED",
      409,
      true,
      { executionId, reason },
    );
  }
}
