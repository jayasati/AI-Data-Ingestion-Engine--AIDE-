import { createHash } from "node:crypto";

/**
 * A prompt version's own metadata — independent of `AIConfig.promptVersion`
 * (a bare string stamped on every execution report since Volume 5). This is
 * richer: who authored it, when, why, and how many times it's actually been
 * compiled — the bookkeeping a real prompt-as-software-artifact needs.
 */
export interface PromptVersionMetadata {
  readonly version: string;
  readonly author: string;
  readonly createdAt: string;
  readonly releaseNotes: string;
  /** Content hash of the version's defining inputs (template id + business rule profile id + schema version) — changes iff the compiled shape would change. */
  readonly contentHash: string;
}

/**
 * A short, deterministic, non-cryptographic-strength content hash — good
 * enough to detect "did this version's defining inputs change," not a
 * security primitive. SHA-256 truncated to 16 hex chars keeps registry
 * entries and logs readable.
 */
export function hashPromptContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function buildPromptVersionMetadata(
  input: Omit<PromptVersionMetadata, "contentHash"> & { readonly hashInput: string },
): PromptVersionMetadata {
  const { hashInput, ...rest } = input;
  return { ...rest, contentHash: hashPromptContent(hashInput) };
}
