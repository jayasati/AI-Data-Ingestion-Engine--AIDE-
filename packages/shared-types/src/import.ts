/** Lifecycle of an import job. String values are wire-format — never renumber. */
export enum ImportStatus {
  Pending = "PENDING",
  Processing = "PROCESSING",
  Completed = "COMPLETED",
  Failed = "FAILED",
  Cancelled = "CANCELLED",
}

export interface ImportAccepted {
  readonly importId: string;
  readonly status: ImportStatus;
}

/** Live progress for an import still `Processing` — see execution/progress/progress-tracker.ts. */
export interface ImportProgressDTO {
  readonly currentStage: string | null;
  readonly currentBatchId: string | null;
  readonly completedRecords: number;
  readonly totalRecords: number;
  readonly remainingRecords: number;
  /** 0-100. */
  readonly percentage: number;
  readonly elapsedMs: number;
  readonly estimatedRemainingMs: number | null;
  readonly throughputRecordsPerSecond: number;
}

/** One batch's outcome — the "Batch Summary" tier the Execution Platform's frontend displays. */
export interface BatchSummaryDTO {
  readonly batchId: string;
  readonly sequenceNumber: number;
  readonly status: "pending" | "running" | "completed" | "failed" | "cancelled";
  readonly recordCount: number;
  readonly durationMs: number | null;
}

/**
 * Aggregate outcome of one import run, shown on the results dashboard.
 * `importedCount` counts only fully `"approved"` records — a `needs_review`
 * record isn't auto-imported (no human review workflow exists yet), so it's
 * broken out separately rather than folded into `importedCount`.
 */
export interface ResultSummary {
  readonly importId: string;
  readonly status: ImportStatus;
  readonly totalRows: number;
  readonly importedCount: number;
  readonly skippedCount: number;
  readonly failedBatches: number;
  readonly durationMs: number;
  readonly needsReviewCount: number;
  readonly rejectedCount: number;
  readonly averageConfidence: number | null;
  readonly averageQualityScore: number | null;
  /** Null once the import reaches a terminal status — nothing left to poll. */
  readonly progress: ImportProgressDTO | null;
  readonly batches: readonly BatchSummaryDTO[];
  readonly errorMessage: string | null;
}
