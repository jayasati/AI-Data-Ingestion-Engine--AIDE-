import { ApplicationError } from "@/core/errors";

/**
 * Thrown by placeholder stages (Semantic Extraction, Validation, Aggregation)
 * if they are ever invoked directly instead of through a stage that returns a
 * `fatal_failure` StageResult. Kept for callers that bypass the runner.
 */
export class StageNotImplementedError extends ApplicationError {
  constructor(stageName: string) {
    super(
      `Pipeline stage "${stageName}" is not implemented yet.`,
      "STAGE_NOT_IMPLEMENTED",
      501,
      true,
      {
        stageName,
      },
    );
  }
}
