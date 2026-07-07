import type { PipelineContext } from "@/pipeline/context/pipeline-context";
import type { StageResult } from "@/pipeline/contracts/stage-result";

/** What a stage hands back: its own result, plus the context it updated. */
export interface StageExecution<TOutput> {
  readonly result: StageResult<TOutput>;
  readonly context: PipelineContext;
}

/**
 * Contract every pipeline stage implements. A stage:
 *  - takes the previous stage's output and the current context,
 *  - never reaches into Express, HTTP, or another stage's internals,
 *  - never throws for expected/data-shaped failures — those are `StageResult`
 *    outcomes; only genuine bugs should throw, and the runner treats an
 *    uncaught throw as a fatal failure it did not expect,
 *  - never transitions `ImportState` itself. The runner owns the state
 *    machine exclusively, because some transitions (entering AI_PROCESSING)
 *    don't correspond to any single stage's output.
 */
export interface PipelineStage<TInput, TOutput> {
  readonly name: string;
  execute(input: TInput, context: PipelineContext): Promise<StageExecution<TOutput>>;
}
