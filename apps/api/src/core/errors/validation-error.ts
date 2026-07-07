import { ApplicationError } from "@/core/errors/application-error";

/** Client sent a syntactically or semantically invalid request. */
export class ValidationError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, true, details);
  }
}
