import type { StageIssue } from "@/pipeline/contracts/stage-result";
import type { DatasetValidationSummary, ValidatedRecord } from "@/pipeline/domain/validation";
import type { BatchExecutionResult } from "@/execution/batch/batch-model";
import type { ExecutionMetrics } from "@/execution/metrics/execution-metrics";
import type { ExecutionState } from "@/execution/state/execution-state";

/**
 * The Execution Platform's own final output — distinct from
 * `pipeline/domain/import-summary.ts`'s `ImportSummary` (the still-unimplemented
 * `AggregationStage`'s per-run output). `ImportResult` is what
 * `aggregateResults()` actually produces today: every approved/needs-review/
 * rejected/skipped record across every *successful* batch, plus which
 * batches failed and why — never blocking successful work on a failed batch
 * elsewhere ("Never discard successful work").
 */
export interface ImportResult {
  readonly importId: string;
  readonly executionId: string;
  readonly finalState: ExecutionState;
  readonly approvedRecords: readonly ValidatedRecord[];
  readonly needsReviewRecords: readonly ValidatedRecord[];
  readonly rejectedRecords: readonly ValidatedRecord[];
  readonly skippedRecords: readonly ValidatedRecord[];
  readonly totalBatches: number;
  readonly succeededBatches: number;
  readonly failedBatches: readonly BatchExecutionResult[];
  /** Every batch's outcome, succeeded or not, in scheduled order — the source for a per-batch summary view. */
  readonly allBatches: readonly BatchExecutionResult[];
  /** Trust Layer summary merged across every successful batch; null only when zero batches succeeded. */
  readonly datasetSummary: DatasetValidationSummary | null;
  readonly metrics: ExecutionMetrics;
  readonly warnings: readonly StageIssue[];
  readonly errors: readonly StageIssue[];
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
}
