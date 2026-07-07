/**
 * Header normalization only — never semantic mapping. Turns "Customer Name"
 * into "customer_name" so downstream consumers (a future API, an export,
 * a semantic-mapping prompt) have a stable machine key; the original header
 * text is preserved alongside it and never altered.
 */
export interface HeaderProfile {
  readonly columnIndex: number;
  readonly originalHeader: string;
  readonly normalizedHeader: string;
  /**
   * True if this column's header collides with another's — either because
   * the original raw text was identical (signaled by `rawDuplicateFlags`,
   * since Volume 2's disambiguator already renamed "Email"/"Email (2)"
   * before this ever runs, so the renamed text no longer looks related on
   * its own), or because two differently-spelled headers normalize to the
   * same key (e.g. "Email Address" and "email-address"). Informational only.
   */
  readonly isDuplicate: boolean;
}

const NON_ALPHANUMERIC_RUN = /[^\p{L}\p{N}]+/gu;
const REPEATED_UNDERSCORES = /_+/g;
const LEADING_OR_TRAILING_UNDERSCORES = /^_+|_+$/g;

export function normalizeHeaderName(header: string): string {
  const slug = header
    .normalize("NFC")
    .replace(NON_ALPHANUMERIC_RUN, "_")
    .replace(REPEATED_UNDERSCORES, "_")
    .replace(LEADING_OR_TRAILING_UNDERSCORES, "")
    .toLowerCase();

  return slug.length > 0 ? slug : "column";
}

/**
 * @param rawDuplicateFlags Optional, from `ParsedDataset.headerDuplicateFlags`
 * — carries forward whether the *original* header text collided, since after
 * Volume 2's disambiguation renames it, that fact is otherwise lost.
 */
export function buildHeaderProfiles(
  headers: readonly string[],
  rawDuplicateFlags?: readonly boolean[],
): readonly HeaderProfile[] {
  const occurrencesByNormalized = new Map<string, number>();

  const profiles = headers.map((originalHeader, columnIndex) => {
    const normalizedHeader = normalizeHeaderName(originalHeader);
    const occurrences = occurrencesByNormalized.get(normalizedHeader) ?? 0;
    occurrencesByNormalized.set(normalizedHeader, occurrences + 1);
    return { columnIndex, originalHeader, normalizedHeader, isDuplicate: false };
  });

  return profiles.map((profile) => ({
    ...profile,
    isDuplicate:
      (occurrencesByNormalized.get(profile.normalizedHeader) ?? 0) > 1 ||
      (rawDuplicateFlags?.[profile.columnIndex] ?? false),
  }));
}
