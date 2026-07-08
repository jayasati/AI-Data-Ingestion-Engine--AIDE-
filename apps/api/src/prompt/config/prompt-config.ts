/**
 * Every tunable knob in the Prompt Engineering Platform, as one injectable
 * object — mirrors `semantic/config/semantic-config.ts`'s pattern. Every
 * stage that needs a knob takes it as an optional parameter defaulting to
 * `DEFAULT_PROMPT_CONFIG`, so a future customer override or a benchmark
 * sweep never has to touch compilation logic itself.
 */
export interface PromptConfig {
  /** Which registered template to compile with by default. */
  readonly templateId: string;
  /** Which registered business rule profile to compile with by default. */
  readonly businessRuleProfileId: string;
  /** Output schema version stamped on every compiled prompt. */
  readonly schemaVersion: string;
  /** Max few-shot examples selected per compilation. */
  readonly maxExamples: number;
  /** Max negative examples selected per compilation. */
  readonly maxNegativeExamples: number;
  /** Hard ceiling on compiled prompt size (system + user, characters) — `PromptValidator` flags anything over this. */
  readonly maxPromptSizeChars: number;
  /** Whether `PromptOptimizer` runs automatically after compilation. */
  readonly optimizeByDefault: boolean;
}

export const DEFAULT_PROMPT_CONFIG: PromptConfig = {
  templateId: "crm-extraction",
  businessRuleProfileId: "default",
  schemaVersion: "v1.0",
  maxExamples: 2,
  maxNegativeExamples: 3,
  maxPromptSizeChars: 60_000,
  optimizeByDefault: true,
};

export function resolvePromptConfig(overrides?: Partial<PromptConfig>): PromptConfig {
  if (!overrides) {
    return DEFAULT_PROMPT_CONFIG;
  }
  return { ...DEFAULT_PROMPT_CONFIG, ...overrides };
}
