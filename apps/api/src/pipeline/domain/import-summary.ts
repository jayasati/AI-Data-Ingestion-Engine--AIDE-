import type { ImportState } from "@/pipeline/context/import-state";

/** Placeholder unit the future Batch Processing volume will schedule and track. */
export interface BatchPlaceholder {
  readonly batchId: string;
  readonly recordCount: number;
  readonly status: "pending";
}

/** Output of the Aggregation stage and the pipeline run as a whole. */
export interface ImportSummary {
  readonly importId: string;
  readonly state: ImportState;
  readonly totalRows: number;
  readonly warningCount: number;
  readonly errorCount: number;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly durationMs: number | null;
}
