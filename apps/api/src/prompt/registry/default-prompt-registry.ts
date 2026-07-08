import { PromptRegistry } from "@/prompt/registry/prompt-registry";
import { buildPromptVersionMetadata } from "@/prompt/versioning/prompt-version";

/**
 * Bumped from the Volume 5 compiler's "v1.0" — this is a genuinely different
 * compiler (composable sections, a configurable Business Rule Builder,
 * negative examples, validation, optimization), not a patch to the old one.
 */
export const PROMPT_VERSION = "v2.0";

export const DEFAULT_PROMPT_REGISTRY = new PromptRegistry();

DEFAULT_PROMPT_REGISTRY.register({
  id: "crm-extraction",
  category: "crm-extraction",
  description: "Maps arbitrary CSV rows onto the 15-field CRM schema.",
  versions: [
    buildPromptVersionMetadata({
      version: PROMPT_VERSION,
      author: "system",
      createdAt: "2026-07-08T00:00:00.000Z",
      releaseNotes:
        "Prompt Engineering Platform: composable sections, configurable Business Rule Builder, " +
        "negative examples, validator, optimizer, observability, versioned registry.",
      hashInput: "crm-extraction:default:v1.0",
    }),
  ],
  currentVersion: PROMPT_VERSION,
});
