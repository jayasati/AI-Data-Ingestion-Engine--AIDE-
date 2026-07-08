import type { AIOrchestrator } from "@/ai/orchestrator";
import { withAIExecutionReport } from "@/ai/shared-state";
import type { PipelineStage, StageExecution } from "@/pipeline/contracts/pipeline-stage";
import type { StageOutcome } from "@/pipeline/contracts/stage-result";
import type { PipelineContext } from "@/pipeline/context";
import type { NormalizedDataset } from "@/pipeline/domain/normalization";
import type { SemanticExtractionResult } from "@/pipeline/domain/extraction";
import { buildStageResult } from "@/pipeline/stages/shared/stage-result-factory";

const STAGE_NAME = "semantic-extraction";

/**
 * Delegates the actual LLM call to an injected `AIOrchestrator` — this class
 * only adapts the orchestrator's request/result shape onto the pipeline's
 * `StageResult` contract. The orchestrator has no knowledge it is running
 * inside a pipeline stage, and this stage has no knowledge of prompts,
 * providers, or parsing; that split is what lets either be tested alone.
 * `provider_error` and `parser_error` both become `fatal_failure` — no retry
 * exists yet ("NO Retry Engine" this volume), so a failed AI call halts the
 * run exactly like any other unrecoverable stage failure.
 */
export class SemanticExtractionStage implements PipelineStage<
  NormalizedDataset,
  SemanticExtractionResult
> {
  readonly name = STAGE_NAME;

  constructor(private readonly orchestrator: AIOrchestrator) {}

  async execute(
    input: NormalizedDataset,
    context: PipelineContext,
  ): Promise<StageExecution<SemanticExtractionResult>> {
    const startedAt = new Date();
    const { extraction, report } = await this.orchestrator.run({ normalizedDataset: input });

    const nextContext = withAIExecutionReport(context, report).mergeStatistics({
      aiRecordsExtracted: extraction.records.length,
      aiTotalTokens: report.tokenUsage.totalTokens,
      aiLatencyMs: report.latencyMs,
    });

    if (report.status !== "success") {
      return {
        context: nextContext,
        result: buildStageResult<SemanticExtractionResult>({
          stageName: STAGE_NAME,
          startedAt,
          metadata: {
            requestId: report.requestId,
            provider: report.provider,
            status: report.status,
          },
          errors:
            report.warnings.length > 0
              ? report.warnings
              : [
                  {
                    code: report.status.toUpperCase(),
                    message: `AI extraction ended with status "${report.status}".`,
                  },
                ],
          outcome: "fatal_failure",
          output: null,
        }),
      };
    }

    const outcome: StageOutcome = report.warnings.length > 0 ? "warning" : "success";

    return {
      context: nextContext,
      result: buildStageResult<SemanticExtractionResult>({
        stageName: STAGE_NAME,
        startedAt,
        metadata: {
          requestId: report.requestId,
          provider: report.provider,
          model: report.model,
          promptVersion: report.promptVersion,
          tokenUsage: report.tokenUsage,
          estimatedCostUsd: report.estimatedCostUsd,
          latencyMs: report.latencyMs,
        },
        warnings: report.warnings,
        outcome,
        output: extraction,
      }),
    };
  }
}
