import type { PromptSectionId } from "@/prompt/types";

export interface OptimizableSection {
  readonly id: PromptSectionId;
  readonly text: string;
}

export interface PromptOptimizationResult {
  readonly sections: readonly OptimizableSection[];
  /** Sections dropped for being empty or an exact duplicate of an earlier one, in original order. */
  readonly removedSectionIds: readonly PromptSectionId[];
  readonly charsRemoved: number;
}

/**
 * Operates on the *structured* section list, never on a raw concatenated
 * string — string-level line dedup would be actively dangerous here, since
 * two unrelated Current Batch JSON lines (e.g. two `"value": null,` lines in
 * different records) can be byte-identical without being "duplicate
 * context." Whitespace normalization is safe against `JSON.stringify`
 * output too: it never emits trailing line whitespace or blank lines, so
 * this is a no-op there and only ever trims prose sections.
 */
export function optimizeSections(
  sections: readonly OptimizableSection[],
): PromptOptimizationResult {
  const seen = new Set<string>();
  const kept: OptimizableSection[] = [];
  const removed: PromptSectionId[] = [];
  let originalChars = 0;
  let optimizedChars = 0;

  for (const section of sections) {
    originalChars += section.text.length;
    const normalized = normalizeWhitespace(section.text);

    if (normalized.length === 0) {
      removed.push(section.id);
      continue;
    }

    const dedupeKey = `${section.id}:${normalized}`;
    if (seen.has(dedupeKey)) {
      removed.push(section.id);
      continue;
    }

    seen.add(dedupeKey);
    kept.push({ id: section.id, text: normalized });
    optimizedChars += normalized.length;
  }

  return {
    sections: kept,
    removedSectionIds: removed,
    charsRemoved: originalChars - optimizedChars,
  };
}

function normalizeWhitespace(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
