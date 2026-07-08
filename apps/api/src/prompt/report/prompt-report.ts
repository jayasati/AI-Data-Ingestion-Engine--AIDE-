import type { PromptExecutionMetadata } from "@/prompt/observability/prompt-observability";

/**
 * The human-facing rollup of one compilation — everything `PromptExecutionMetadata`
 * carries, plus the business-rule profile and schema version it doesn't (those
 * are compile-time choices, not execution-time facts), and validation issues
 * flattened into plain-language warnings.
 */
export interface PromptReport {
  readonly promptVersion: string;
  readonly promptHash: string;
  readonly templateId: string;
  readonly businessRuleProfileId: string;
  readonly schemaVersion: string;
  readonly examplesUsed: readonly string[];
  readonly negativeExamplesUsed: readonly string[];
  readonly contextSizeChars: number;
  readonly estimatedPromptTokens: number;
  readonly estimatedCompletionTokens: number;
  readonly estimatedCostUsd: number | null;
  readonly compilationTimeMs: number;
  readonly warnings: readonly string[];
}

export function buildPromptReport(
  metadata: PromptExecutionMetadata,
  businessRuleProfileId: string,
  schemaVersion: string,
): PromptReport {
  return {
    promptVersion: metadata.promptVersion,
    promptHash: metadata.promptHash,
    templateId: metadata.templateId,
    businessRuleProfileId,
    schemaVersion,
    examplesUsed: metadata.examplesUsed,
    negativeExamplesUsed: metadata.negativeExamplesUsed,
    contextSizeChars: metadata.contextSizeChars,
    estimatedPromptTokens: metadata.estimatedPromptTokens,
    estimatedCompletionTokens: metadata.estimatedCompletionTokens,
    estimatedCostUsd: metadata.estimatedCostUsd,
    compilationTimeMs: metadata.compilationTimeMs,
    warnings: metadata.validation.issues.map((issue) => issue.message),
  };
}
