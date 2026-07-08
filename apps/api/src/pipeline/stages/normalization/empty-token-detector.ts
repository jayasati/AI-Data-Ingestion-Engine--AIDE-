export const DEFAULT_NULL_ALIASES: ReadonlySet<string> = new Set([
  "",
  "n/a",
  "na",
  "#n/a",
  "-",
  "--",
  "null",
  "none",
  "unknown",
  "nil",
  "undefined",
]);

/** Recognizes the common ways a source system spells "no value" as literal text. Aliases are configurable. */
export function isEmptyToken(
  value: string,
  aliases: ReadonlySet<string> = DEFAULT_NULL_ALIASES,
): boolean {
  return aliases.has(value.trim().toLowerCase());
}
