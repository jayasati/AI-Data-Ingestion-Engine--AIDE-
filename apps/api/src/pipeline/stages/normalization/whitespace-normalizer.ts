const LINE_BREAK_VARIANTS = /\r\n|\r/g;
const HORIZONTAL_WHITESPACE_RUN = /[ \t]+/g;

/** Unifies CRLF/CR to LF without touching intentional newlines in multi-line cells. */
export function unifyLineBreaks(value: string): string {
  return value.replace(LINE_BREAK_VARIANTS, "\n");
}

/** Trims the cell and collapses runs of spaces/tabs — never collapses newlines. */
export function trimAndCollapseWhitespace(value: string): string {
  return value
    .split("\n")
    .map((line) => line.replace(HORIZONTAL_WHITESPACE_RUN, " ").trim())
    .join("\n")
    .trim();
}
