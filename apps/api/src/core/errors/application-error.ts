/**
 * Base of the AIDE error hierarchy. Every intentional failure in the system is
 * an ApplicationError subclass; anything else reaching the error handler is a bug
 * and gets wrapped in UnknownError.
 */
export abstract class ApplicationError extends Error {
  /** Stable machine-readable code surfaced to clients in the API envelope. */
  readonly code: string;
  readonly httpStatus: number;
  /**
   * Operational errors are expected failures whose message is safe to expose to
   * clients. Non-operational errors indicate bugs — clients get a generic message.
   */
  readonly isOperational: boolean;
  /** Structured context for the envelope (e.g. field-level issues). Never stack traces. */
  readonly details?: unknown;

  protected constructor(
    message: string,
    code: string,
    httpStatus: number,
    isOperational: boolean,
    details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}
