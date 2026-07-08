import type { PromptSectionId } from "@/prompt/types";

/**
 * Describes what a compiled prompt is made of and in what order — not the
 * text itself. `userSections`' last entry must be `"current_batch"`: see
 * `sections/current-batch-section.ts` for why (MockProvider's batch scan).
 */
export interface PromptTemplate {
  readonly id: string;
  readonly description: string;
  readonly systemSections: readonly PromptSectionId[];
  readonly userSections: readonly PromptSectionId[];
}
