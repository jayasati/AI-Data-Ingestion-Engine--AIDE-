/**
 * Every distinct block a compiled prompt can be made of. Order here is
 * documentation only — actual ordering is owned by `templates/`, since
 * "# Current Batch" must always be the compiled user message's last section
 * (see `sections/current-batch-section.ts` for why: `MockProvider` locates it
 * by marker text and reads the last JSON object after it).
 */
export const PROMPT_SECTION_IDS = [
  "identity",
  "mission",
  "business_rules",
  "dataset_context",
  "examples",
  "negative_examples",
  "output_schema",
  "current_batch",
] as const;

export type PromptSectionId = (typeof PROMPT_SECTION_IDS)[number];

/** Which of the two provider-facing messages a section belongs to. */
export type PromptMessageRole = "system" | "user";
