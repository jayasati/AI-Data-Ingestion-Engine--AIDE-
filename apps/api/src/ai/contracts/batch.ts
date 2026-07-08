import type { NormalizedRecord } from "@/pipeline/domain/normalization";
import type { AIExecutionReport } from "@/ai/contracts/execution";
import type { SemanticExtractionResult } from "@/pipeline/domain/extraction";
import type { DatasetContext } from "@/ai/context/dataset-context-builder";

/**
 * Batch shapes only — no concurrency, no scheduler, no worker pool. This
 * volume runs exactly one batch (the whole dataset) sequentially through the
 * orchestrator; these interfaces exist so a future batching volume can slot
 * in parallel execution without changing what a "batch" or a "batch result"
 * means to the rest of the system.
 */
export interface AIBatch {
  readonly batchId: string;
  readonly records: readonly NormalizedRecord[];
}

export interface BatchContext {
  readonly batch: AIBatch;
  readonly datasetContext: DatasetContext;
}

export interface BatchResult {
  readonly batchId: string;
  readonly extraction: SemanticExtractionResult;
  readonly report: AIExecutionReport;
}

export type BatchStatus = "pending" | "completed" | "failed";

export interface BatchMetadata {
  readonly batchId: string;
  readonly recordCount: number;
  readonly status: BatchStatus;
}
