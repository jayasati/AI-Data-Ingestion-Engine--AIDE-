import type { AIExecutionReport } from "@/ai/contracts/execution";
import type { StageIssue } from "@/pipeline/contracts/stage-result";
import type { NormalizationReport } from "@/pipeline/domain/normalization";
import type { ParsedDataset } from "@/pipeline/domain/parsing";
import type { ValidationResult } from "@/pipeline/domain/validation";
import type { ExecutionTiming } from "@/execution/types";

export type BatchExecutionStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/**
 * One unit of scheduled work — a slice of `ParsedDataset.rows`, still
 * carrying the source dataset's headers/delimiter/encoding, so a worker can
 * run it through Normalization onward exactly as if it were the whole file.
 * Deliberately NOT `ai/contracts/batch.ts`'s `AIBatch` (records already
 * normalized): that type anticipates a narrower, post-normalization AI-call
 * batch that nothing wires to today; this one is the Batch Scheduler's own
 * pre-normalization unit, matching the spec's "Workers execute Normalization
 * -> ..." — normalization itself runs per batch, not once globally.
 */
export interface ExecutionBatch {
  readonly batchId: string;
  readonly importId: string;
  readonly sequenceNumber: number;
  readonly parsedDataset: ParsedDataset;
  readonly recordCount: number;
  readonly metadata: Readonly<Record<string, unknown>>;
  /** Known only once a worker has compiled a prompt for this batch; null until then. */
  readonly estimatedTokens: number | null;
  readonly estimatedCostUsd: number | null;
  /** Always empty today — every batch is independent. Kept so a future volume with genuine inter-batch dependencies doesn't need a new type. */
  readonly dependsOn: readonly string[];
}

/** What a worker hands back after running one batch through the full pipeline. */
export interface BatchExecutionResult {
  readonly batchId: string;
  readonly sequenceNumber: number;
  readonly status: BatchExecutionStatus;
  readonly validation: ValidationResult | null;
  readonly aiReport: AIExecutionReport | null;
  readonly normalizationReport: NormalizationReport | null;
  readonly warnings: readonly StageIssue[];
  readonly errors: readonly StageIssue[];
  readonly timing: ExecutionTiming;
  readonly statistics: Readonly<Record<string, number>>;
}
