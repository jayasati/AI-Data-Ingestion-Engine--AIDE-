export interface DisambiguatedHeaders {
  readonly headers: readonly string[];
  readonly duplicatesRenamed: number;
  readonly emptyHeadersRenamed: number;
  /** True for every column whose original (pre-rename) header text was shared by another column. */
  readonly wasOriginallyDuplicate: readonly boolean[];
}

/**
 * Structural header cleanup only — never semantic. Blank column names get a
 * positional placeholder and repeated names get a "(2)", "(3)"... suffix so
 * downstream code can safely key records by header text without collisions.
 * The original text is never rewritten otherwise. `wasOriginallyDuplicate`
 * preserves the fact that a collision happened at all, since after renaming
 * "Email"/"Email (2)" no longer look related by their text alone — the
 * Header Engine's own duplicate detection (on normalized form) relies on this
 * to still flag exact-duplicate raw headers, not just differently-spelled ones.
 */
export function disambiguateHeaders(rawHeaders: readonly string[]): DisambiguatedHeaders {
  const totalOccurrences = new Map<string, number>();
  for (const rawHeader of rawHeaders) {
    if (rawHeader.trim() === "") {
      continue;
    }
    totalOccurrences.set(rawHeader, (totalOccurrences.get(rawHeader) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  let duplicatesRenamed = 0;
  let emptyHeadersRenamed = 0;
  const wasOriginallyDuplicate: boolean[] = [];

  const headers = rawHeaders.map((rawHeader, index) => {
    if (rawHeader.trim() === "") {
      emptyHeadersRenamed += 1;
      wasOriginallyDuplicate.push(false);
      return `Column ${index + 1}`;
    }

    wasOriginallyDuplicate.push((totalOccurrences.get(rawHeader) ?? 0) > 1);

    const occurrences = seen.get(rawHeader) ?? 0;
    seen.set(rawHeader, occurrences + 1);
    if (occurrences === 0) {
      return rawHeader;
    }
    duplicatesRenamed += 1;
    return `${rawHeader} (${occurrences + 1})`;
  });

  return { headers, duplicatesRenamed, emptyHeadersRenamed, wasOriginallyDuplicate };
}
