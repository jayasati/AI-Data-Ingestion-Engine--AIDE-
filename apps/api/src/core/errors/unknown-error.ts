import { ApplicationError } from "@/core/errors/application-error";

/** Wrapper for anything reaching the error handler that is not an ApplicationError. */
export class UnknownError extends ApplicationError {
  constructor(message = "An unexpected error occurred.", details?: unknown) {
    super(message, "UNKNOWN_ERROR", 500, false, details);
  }
}
