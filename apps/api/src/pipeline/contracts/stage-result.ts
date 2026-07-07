/**
 * Four outcomes a stage can report — never more, never fewer. The runner (not
 * the stage) decides what happens next; a stage only classifies what happened.
 *
 *  - success:              produced valid output, nothing to flag.
 *  - warning:               produced valid output, but something is worth surfacing.
 *  - recoverable_failure:   produced no output; the failure is data-shaped and,
 *                            once retry logic exists, could be retried without
 *                            restarting the whole import. No retry mechanism
 *                            exists yet, so today the runner treats this the
 *                            same as fatal_failure — the distinction is kept so
 *                            a future retry-aware runner does not need this
 *                            contract to change.
 *  - fatal_failure:         produced no output; retrying would not help
 *                            (malformed input, programming error, not-yet-implemented stage).
 */
export type StageOutcome = "success" | "warning" | "recoverable_failure" | "fatal_failure";

export interface StageIssue {
  /** Stable machine-readable code, e.g. "EMPTY_FILE", "DELIMITER_NOT_DETECTED". */
  readonly code: string;
  readonly message: string;
  readonly context?: Record<string, unknown>;
}

export type StageWarning = StageIssue;

export interface StageTiming {
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
}

export interface StageMetadata {
  readonly [key: string]: unknown;
}

/** Everything the runner and observability layer need about one stage's run. */
export interface StageExecutionInfo {
  readonly stageName: string;
  readonly outcome: StageOutcome;
  readonly timing: StageTiming;
  readonly metadata: StageMetadata;
  readonly warnings: readonly StageWarning[];
  readonly errors: readonly StageIssue[];
}

export type StageResult<TOutput> =
  | { readonly outcome: "success"; readonly output: TOutput; readonly info: StageExecutionInfo }
  | { readonly outcome: "warning"; readonly output: TOutput; readonly info: StageExecutionInfo }
  | {
      readonly outcome: "recoverable_failure";
      readonly output: null;
      readonly info: StageExecutionInfo;
    }
  | { readonly outcome: "fatal_failure"; readonly output: null; readonly info: StageExecutionInfo };

/** True for the two outcomes that carry usable output. */
export function stageSucceeded<T>(
  result: StageResult<T>,
): result is Extract<StageResult<T>, { outcome: "success" | "warning" }> {
  return result.outcome === "success" || result.outcome === "warning";
}
