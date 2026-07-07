import { ApplicationError } from "@/core/errors/application-error";

/**
 * Invalid or missing configuration. Non-operational: the process should fail to
 * boot rather than run with a broken config.
 */
export class ConfigurationError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, "CONFIGURATION_ERROR", 500, false, details);
  }
}
