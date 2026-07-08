import type { PromptSectionId } from "@/prompt/types";

export interface PromptSectionResult {
  readonly id: PromptSectionId;
  readonly text: string;
}
