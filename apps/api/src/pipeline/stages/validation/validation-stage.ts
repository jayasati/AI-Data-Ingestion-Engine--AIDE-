import type { PipelineStage, StageExecution } from "@/pipeline/contracts/pipeline-stage";
import type { StageOutcome } from "@/pipeline/contracts/stage-result";
import type { PipelineContext } from "@/pipeline/context";
import type { SemanticExtractionResult } from "@/pipeline/domain/extraction";
import type { ValidationResult } from "@/pipeline/domain/validation";
import { buildStageResult } from "@/pipeline/stages/shared/stage-result-factory";
import { runTrustLayer } from "@/trust";
import type { TrustConfig } from "@/trust";

const STAGE_NAME = "validation";

/**
 * Delegates every record to the Trust Layer (`@/trust`'s `runTrustLayer()`)
 * — this class only adapts its `ValidationResult` onto the pipeline's
 * `StageResult` contract, exactly as `SemanticExtractionStage` adapts
 * `AIOrchestrator`. A record landing on `"rejected"` or `"skipped"` is
 * expected, routine output, never a stage failure — `outcome` is
 * `"warning"` whenever any record isn't `"approved"`, `"success"` only when
 * every record is. This stage cannot fail on its own; `runTrustLayer` never
 * throws for a malformed record (only a genuine programming error would).
 */
export class ValidationStage implements PipelineStage<SemanticExtractionResult, ValidationResult> {
  readonly name = STAGE_NAME;

  constructor(private readonly config?: Partial<TrustConfig>) {}

  async execute(
    input: SemanticExtractionResult,
    context: PipelineContext,
  ): Promise<StageExecution<ValidationResult>> {
    const startedAt = new Date();
    const result = runTrustLayer({ extraction: input, config: this.config });

    const outcome: StageOutcome =
      result.summary.approvedCount === result.summary.totalRecords ? "success" : "warning";

    const nextContext = context.mergeStatistics({
      approvedRecords: result.summary.approvedCount,
      needsReviewRecords: result.summary.needsReviewCount,
      rejectedRecords: result.summary.rejectedCount,
      skippedRecords: result.summary.skippedCount,
      totalRepairs: result.summary.totalRepairs,
    });

    return {
      context: nextContext,
      result: buildStageResult<ValidationResult>({
        stageName: STAGE_NAME,
        startedAt,
        metadata: {
          totalRecords: result.summary.totalRecords,
          averageConfidence: result.summary.averageConfidence,
          averageQualityScore: result.summary.averageQualityScore,
        },
        outcome,
        output: result,
      }),
    };
  }
}
