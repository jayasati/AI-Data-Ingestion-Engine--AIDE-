/** Lifecycle of an import job. String values are wire-format — never renumber. */
export enum ImportStatus {
  Pending = "PENDING",
  Processing = "PROCESSING",
  Completed = "COMPLETED",
  Failed = "FAILED",
  Cancelled = "CANCELLED",
}

/** Aggregate outcome of one import run, shown on the results dashboard. */
export interface ResultSummary {
  importId: string;
  status: ImportStatus;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  failedBatches: number;
  durationMs: number;
}
