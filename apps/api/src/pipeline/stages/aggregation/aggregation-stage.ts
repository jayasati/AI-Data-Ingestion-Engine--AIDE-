import type { PipelineStage, StageExecution } from "@/pipeline/contracts/pipeline-stage";
import type { PipelineContext } from "@/pipeline/context";
import type { ImportSummary } from "@/pipeline/domain/import-summary";
import type { ValidationResult } from "@/pipeline/domain/validation";
import { buildStageResult } from "@/pipeline/stages/shared/stage-result-factory";

const STAGE_NAME = "aggregation";

/**
 * Placeholder. A later volume replaces this class body with the statistics
 * generator that folds `ValidationResult` into a final `ImportSummary` — the
 * contract (`PipelineStage<ValidationResult, ImportSummary>`) is not expected
 * to change. Always reports `fatal_failure`; see SemanticExtractionStage for
 * why that is the correct placeholder behavior.
 */
export class AggregationStage implements PipelineStage<ValidationResult, ImportSummary> {
  readonly name = STAGE_NAME;

  async execute(
    _input: ValidationResult,
    context: PipelineContext,
  ): Promise<StageExecution<ImportSummary>> {
    const startedAt = new Date();

    return {
      context,
      result: buildStageResult<ImportSummary>({
        stageName: STAGE_NAME,
        startedAt,
        metadata: {},
        errors: [
          {
            code: "STAGE_NOT_IMPLEMENTED",
            message: "Aggregation is not implemented yet.",
          },
        ],
        outcome: "fatal_failure",
        output: null,
      }),
    };
  }
}
