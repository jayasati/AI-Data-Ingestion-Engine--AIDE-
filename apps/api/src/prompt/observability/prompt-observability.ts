import type { PromptValidationResult } from "@/prompt/validator/prompt-validator";
import type { TokenEstimate } from "@/prompt/tokens/token-estimator";

/**
 * Everything an operator needs to know about how ONE prompt was assembled —
 * distinct from `AIExecutionReport` (which covers the provider call itself).
 * Never includes the compiled prompt text, per the spec's "do not expose raw
 * prompt text" rule for anything client-facing.
 */
export interface PromptExecutionMetadata {
  readonly promptVersion: string;
  readonly promptHash: string;
  readonly templateId: string;
  readonly examplesUsed: readonly string[];
  readonly negativeExamplesUsed: readonly string[];
  readonly contextSizeChars: number;
  readonly estimatedPromptTokens: number;
  readonly estimatedCompletionTokens: number;
  readonly estimatedCostUsd: number | null;
  readonly compilationTimeMs: number;
  readonly validation: PromptValidationResult;
}

export interface PromptExecutionMetadataInput {
  readonly promptVersion: string;
  readonly promptHash: string;
  readonly templateId: string;
  readonly examplesUsed: readonly string[];
  readonly negativeExamplesUsed: readonly string[];
  readonly systemMessage: string;
  readonly userMessage: string;
  readonly tokenEstimate: TokenEstimate;
  readonly compilationTimeMs: number;
  readonly validation: PromptValidationResult;
}

export function buildPromptExecutionMetadata(
  input: PromptExecutionMetadataInput,
): PromptExecutionMetadata {
  return {
    promptVersion: input.promptVersion,
    promptHash: input.promptHash,
    templateId: input.templateId,
    examplesUsed: input.examplesUsed,
    negativeExamplesUsed: input.negativeExamplesUsed,
    contextSizeChars: input.systemMessage.length + input.userMessage.length,
    estimatedPromptTokens: input.tokenEstimate.promptTokens,
    estimatedCompletionTokens: input.tokenEstimate.estimatedCompletionTokens,
    estimatedCostUsd: input.tokenEstimate.estimatedCostUsd,
    compilationTimeMs: input.compilationTimeMs,
    validation: input.validation,
  };
}
