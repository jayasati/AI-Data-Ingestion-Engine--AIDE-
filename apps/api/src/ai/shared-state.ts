import type { AIExecutionReport } from "@/ai/contracts/execution";
import type { PipelineContext } from "@/pipeline/context";

/**
 * `PipelineContext.sharedState` is an untyped bag by design (the context has
 * no knowledge of the AI module). These two functions are the single place
 * that casts it back to `AIExecutionReport`, so every reader — the pipeline
 * stage that writes it and any diagnostic endpoint that reads it — goes
 * through the same typed accessor instead of repeating an inline cast.
 */
const AI_EXECUTION_REPORT_KEY = "aiExecutionReport";

export function withAIExecutionReport(
  context: PipelineContext,
  report: AIExecutionReport,
): PipelineContext {
  return context.withSharedState(AI_EXECUTION_REPORT_KEY, report);
}

export function readAIExecutionReport(context: PipelineContext): AIExecutionReport | undefined {
  return context.sharedState[AI_EXECUTION_REPORT_KEY] as AIExecutionReport | undefined;
}
