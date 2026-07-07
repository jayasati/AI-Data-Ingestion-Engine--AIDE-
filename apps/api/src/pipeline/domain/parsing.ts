/** One data row exactly as it appeared in the source file — no normalization applied. */
export interface ParsedRow {
  /** 1-based, counted over data rows only (the header row is not row 1). */
  readonly rowNumber: number;
  readonly cells: readonly string[];
}

/** Output of the CSV Parsing stage: structurally valid, still semantically raw. */
export interface ParsedDataset {
  readonly headers: readonly string[];
  readonly rows: readonly ParsedRow[];
  readonly delimiter: string;
  readonly rowCount: number;
  readonly columnCount: number;
}
