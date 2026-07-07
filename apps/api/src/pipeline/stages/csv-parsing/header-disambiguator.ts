export interface DisambiguatedHeaders {
  readonly headers: readonly string[];
  readonly duplicatesRenamed: number;
  readonly emptyHeadersRenamed: number;
}

/**
 * Structural header cleanup only — never semantic. Blank column names get a
 * positional placeholder and repeated names get a "(2)", "(3)"... suffix so
 * downstream code can safely key records by header text without collisions.
 * The original text is never rewritten otherwise (that is Volume 3's job).
 */
export function disambiguateHeaders(rawHeaders: readonly string[]): DisambiguatedHeaders {
  const seen = new Map<string, number>();
  let duplicatesRenamed = 0;
  let emptyHeadersRenamed = 0;

  const headers = rawHeaders.map((rawHeader, index) => {
    let header = rawHeader;
    if (header.trim() === "") {
      header = `Column ${index + 1}`;
      emptyHeadersRenamed += 1;
    }

    const occurrences = seen.get(header) ?? 0;
    seen.set(header, occurrences + 1);
    if (occurrences === 0) {
      return header;
    }
    duplicatesRenamed += 1;
    return `${header} (${occurrences + 1})`;
  });

  return { headers, duplicatesRenamed, emptyHeadersRenamed };
}
