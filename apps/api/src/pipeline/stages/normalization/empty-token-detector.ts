const EMPTY_TOKENS = new Set(["", "n/a", "na", "-", "--", "null", "none", "unknown"]);

/** Recognizes the common ways a source system spells "no value" as literal text. */
export function isEmptyToken(value: string): boolean {
  return EMPTY_TOKENS.has(value.trim().toLowerCase());
}
