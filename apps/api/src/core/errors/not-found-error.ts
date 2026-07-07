import { ApplicationError } from "@/core/errors/application-error";

export class NotFoundError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, "NOT_FOUND", 404, true, details);
  }
}
