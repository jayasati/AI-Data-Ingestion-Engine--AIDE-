import type { PipelineStage, StageExecution } from "@/pipeline/contracts/pipeline-stage";
import type { PipelineContext } from "@/pipeline/context";
import type { NormalizedDataset } from "@/pipeline/domain/normalization";
import type { SemanticExtractionResult } from "@/pipeline/domain/extraction";
import { buildStageResult } from "@/pipeline/stages/shared/stage-result-factory";

const STAGE_NAME = "semantic-extraction";

/**
 * Placeholder. The AI core volume replaces this class body with the provider
 * adapter, batching, and the six-layer prompt — the contract (`PipelineStage<
 * NormalizedDataset, SemanticExtractionResult>`) is not expected to change.
 * Always reports `fatal_failure` so the runner halts here deliberately rather
 * than silently producing an empty/wrong extraction result.
 */
export class SemanticExtractionStage implements PipelineStage<
  NormalizedDataset,
  SemanticExtractionResult
> {
  readonly name = STAGE_NAME;

  async execute(
    _input: NormalizedDataset,
    context: PipelineContext,
  ): Promise<StageExecution<SemanticExtractionResult>> {
    const startedAt = new Date();

    return {
      context,
      result: buildStageResult<SemanticExtractionResult>({
        stageName: STAGE_NAME,
        startedAt,
        metadata: {},
        errors: [
          {
            code: "STAGE_NOT_IMPLEMENTED",
            message:
              "Semantic Extraction is not implemented yet; it lands with the AI core volume.",
          },
        ],
        outcome: "fatal_failure",
        output: null,
      }),
    };
  }
}
