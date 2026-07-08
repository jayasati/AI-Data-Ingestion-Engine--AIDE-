import type { AITokenUsage } from "@/ai/contracts/llm-provider";

/** ~4 characters per token is a standard rough estimate for English text. */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Illustrative per-1K-token USD pricing, approximate and subject to change —
 * good enough for a rough cost estimate in an execution report, not a
 * billing source of truth. Models with no known price (e.g. Mock) return null.
 */
const COST_PER_1K_TOKENS_USD: Readonly<Record<string, { prompt: number; completion: number }>> = {
  "gpt-4o": { prompt: 0.0025, completion: 0.01 },
  "gpt-4o-mini": { prompt: 0.00015, completion: 0.0006 },
  "gpt-4.1": { prompt: 0.002, completion: 0.008 },
  "gpt-4.1-mini": { prompt: 0.0004, completion: 0.0016 },
  "gemini-2.5-flash": { prompt: 0.0003, completion: 0.0025 },
  "gemini-2.5-pro": { prompt: 0.00125, completion: 0.01 },
  "claude-sonnet-5": { prompt: 0.003, completion: 0.015 },
  "claude-opus-4-8": { prompt: 0.015, completion: 0.075 },
  "claude-haiku-4-5": { prompt: 0.0008, completion: 0.004 },
};

export function estimateCostUsd(model: string, usage: AITokenUsage): number | null {
  const pricing = COST_PER_1K_TOKENS_USD[model];
  if (!pricing) {
    return null;
  }
  return (
    (usage.promptTokens / 1000) * pricing.prompt +
    (usage.completionTokens / 1000) * pricing.completion
  );
}
