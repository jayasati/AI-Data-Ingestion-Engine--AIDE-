import { ApplicationError } from "@/core/errors";

/**
 * Thrown when the runner (or a stage) attempts a state transition the import
 * lifecycle does not allow. This indicates a bug in orchestration logic, not a
 * data problem — non-operational, so the generic message reaches clients.
 */
export class IllegalStateTransitionError extends ApplicationError {
  constructor(from: string, to: string) {
    super(
      `Illegal import state transition from "${from}" to "${to}".`,
      "ILLEGAL_STATE_TRANSITION",
      500,
      false,
      {
        from,
        to,
      },
    );
  }
}
