import type {
  StageExecutionInfo,
  StageIssue,
  StageMetadata,
  StageOutcome,
  StageResult,
  StageWarning,
} from "@/pipeline/contracts/stage-result";

interface BuildStageResultParams<TOutput> {
  readonly stageName: string;
  readonly startedAt: Date;
  readonly metadata: StageMetadata;
  readonly warnings?: readonly StageWarning[];
  readonly errors?: readonly StageIssue[];
  readonly outcome: StageOutcome;
  readonly output: TOutput | null;
}

/**
 * Every stage builds its `StageResult` through this factory so timing capture
 * and the success/failure output-typing split happen in exactly one place.
 */
export function buildStageResult<TOutput>(
  params: BuildStageResultParams<TOutput>,
): StageResult<TOutput> {
  const completedAt = new Date();
  const info: StageExecutionInfo = {
    stageName: params.stageName,
    outcome: params.outcome,
    timing: {
      startedAt: params.startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - params.startedAt.getTime(),
    },
    metadata: params.metadata,
    warnings: params.warnings ?? [],
    errors: params.errors ?? [],
  };

  if (params.outcome === "success" || params.outcome === "warning") {
    return { outcome: params.outcome, output: params.output as TOutput, info };
  }
  return { outcome: params.outcome, output: null, info };
}
