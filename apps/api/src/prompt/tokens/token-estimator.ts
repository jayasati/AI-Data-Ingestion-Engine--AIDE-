import { estimateCostUsd, estimateTokenCount } from "@/ai/orchestrator/token-estimator";

export { estimateTokenCount, estimateCostUsd };

export interface TokenEstimate {
  readonly promptTokens: number;
  /** Heuristic only — the real number is whatever the provider actually returns. */
  readonly estimatedCompletionTokens: number;
  readonly totalEstimatedTokens: number;
  readonly estimatedCostUsd: number | null;
  readonly maxContextTokens: number;
  readonly exceedsMaxContext: boolean;
}

/** Rough per-record completion budget: 15 fields, short values, some null — a stable heuristic, not a measurement. */
const DEFAULT_COMPLETION_TOKENS_PER_RECORD = 60;

/**
 * Estimates prompt + completion tokens, cost, and max-context headroom for a
 * not-yet-sent request. Truncation (dropping/splitting a batch that would
 * exceed `maxContextTokens`) is intentionally not implemented this volume —
 * `exceedsMaxContext` is the signal a future truncation step would act on.
 */
export function estimatePromptTokens(
  systemMessage: string,
  userMessage: string,
  model: string,
  maxContextTokens: number,
  recordCount = 0,
  completionTokensPerRecord: number = DEFAULT_COMPLETION_TOKENS_PER_RECORD,
): TokenEstimate {
  const promptTokens = estimateTokenCount(systemMessage) + estimateTokenCount(userMessage);
  const estimatedCompletionTokens = Math.max(0, recordCount) * completionTokensPerRecord;
  const totalEstimatedTokens = promptTokens + estimatedCompletionTokens;

  return {
    promptTokens,
    estimatedCompletionTokens,
    totalEstimatedTokens,
    estimatedCostUsd: estimateCostUsd(model, {
      promptTokens,
      completionTokens: estimatedCompletionTokens,
      totalTokens: totalEstimatedTokens,
    }),
    maxContextTokens,
    exceedsMaxContext: totalEstimatedTokens > maxContextTokens,
  };
}
