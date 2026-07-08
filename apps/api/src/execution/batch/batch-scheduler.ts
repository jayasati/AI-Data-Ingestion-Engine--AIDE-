import { ConfigurationError } from "@/core/errors";
import type { ParsedDataset } from "@/pipeline/domain/parsing";
import {
  DEFAULT_EXECUTION_CONFIG,
  type ExecutionConfig,
} from "@/execution/config/execution-config";
import type { ExecutionBatch } from "@/execution/batch/batch-model";

/**
 * Splits a parsed dataset's rows into ordered, independent batches —
 * `config.batchSize` decides how many rows per batch, never a hardcoded
 * constant, so this is where "prepare for adaptive batch sizing" actually
 * plugs in later (a future scheduler could compute batchSize per call
 * instead of reading one fixed number, without this function's callers
 * changing). Sequence numbers are 1-based and gap-free, preserving row
 * order across batches — a downstream consumer can always reconstruct the
 * original ordering from `sequenceNumber` alone.
 */
export function scheduleBatches(
  dataset: ParsedDataset,
  importId: string,
  config: ExecutionConfig = DEFAULT_EXECUTION_CONFIG,
): readonly ExecutionBatch[] {
  if (config.batchSize <= 0) {
    throw new ConfigurationError(
      `batchSize must be a positive integer (received ${config.batchSize}).`,
    );
  }

  const batches: ExecutionBatch[] = [];
  let sequenceNumber = 0;

  for (let start = 0; start < dataset.rows.length; start += config.batchSize) {
    sequenceNumber += 1;
    const rowSlice = dataset.rows.slice(start, start + config.batchSize);

    batches.push({
      batchId: `${importId}-batch-${sequenceNumber}`,
      importId,
      sequenceNumber,
      parsedDataset: { ...dataset, rows: rowSlice, rowCount: rowSlice.length },
      recordCount: rowSlice.length,
      metadata: {},
      estimatedTokens: null,
      estimatedCostUsd: null,
      dependsOn: [],
    });
  }

  return batches;
}
