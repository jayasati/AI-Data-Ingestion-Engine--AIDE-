import type { ImportState } from "@/pipeline/context/import-state";
import type { PipelineContext } from "@/pipeline/context/pipeline-context";
import type {
  StageExecutionInfo,
  StageIssue,
  StageWarning,
} from "@/pipeline/contracts/stage-result";

/** Run-level summary derived from the final context — the runner's return value. */
export interface ExecutionReport {
  readonly importId: string;
  readonly finalState: ImportState;
  readonly stages: readonly StageExecutionInfo[];
  readonly warnings: readonly StageWarning[];
  readonly errors: readonly StageIssue[];
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
}

export interface PipelineRunResult {
  readonly context: PipelineContext;
  readonly report: ExecutionReport;
}
