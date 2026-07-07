import { ApplicationError } from "@/core/errors/application-error";

/** A downstream dependency (AI provider, storage, network) failed. */
export class InfrastructureError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, "INFRASTRUCTURE_ERROR", 502, true, details);
  }
}
