import type { PipelineStage, StageExecution } from "@/pipeline/contracts/pipeline-stage";
import type { PipelineContext } from "@/pipeline/context";
import type { SemanticExtractionResult } from "@/pipeline/domain/extraction";
import type { ValidationResult } from "@/pipeline/domain/validation";
import { buildStageResult } from "@/pipeline/stages/shared/stage-result-factory";

const STAGE_NAME = "validation";

/**
 * Placeholder. The validation & trust engine volume replaces this class body
 * with schema/field/business-rule checks and confidence scoring — the
 * contract (`PipelineStage<SemanticExtractionResult, ValidationResult>`) is
 * not expected to change. Always reports `fatal_failure`; see
 * SemanticExtractionStage for why that is the correct placeholder behavior.
 */
export class ValidationStage implements PipelineStage<SemanticExtractionResult, ValidationResult> {
  readonly name = STAGE_NAME;

  async execute(
    _input: SemanticExtractionResult,
    context: PipelineContext,
  ): Promise<StageExecution<ValidationResult>> {
    const startedAt = new Date();

    return {
      context,
      result: buildStageResult<ValidationResult>({
        stageName: STAGE_NAME,
        startedAt,
        metadata: {},
        errors: [
          {
            code: "STAGE_NOT_IMPLEMENTED",
            message:
              "Validation is not implemented yet; it lands with the validation & trust engine volume.",
          },
        ],
        outcome: "fatal_failure",
        output: null,
      }),
    };
  }
}
