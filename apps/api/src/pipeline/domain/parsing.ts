import type { StageIssue } from "@/pipeline/contracts/stage-result";

/** "ok": cell count matched the header. "recovered": the row was padded or truncated to fit. */
export type RowParsingStatus = "ok" | "recovered";

/**
 * One data row exactly as it appeared in the source file. `rawCells` is the
 * exact tokenizer output (pre-reconciliation); `cells` is the reconciled
 * ("parsed") array every downstream stage consumes — its name and meaning
 * are unchanged from Volume 2 so existing consumers are unaffected.
 */
export interface ParsedRow {
  /** 1-based, counted over data rows only (the header row is not row 1). */
  readonly rowNumber: number;
  readonly rawCells: readonly string[];
  readonly cells: readonly string[];
  readonly status: RowParsingStatus;
  readonly warnings: readonly StageIssue[];
  /** Extensibility bag later stages may attach data to, without changing this type. */
  readonly context: Readonly<Record<string, unknown>>;
}

/** Output of the CSV Parsing stage: structurally valid, still semantically raw. */
export interface ParsedDataset {
  readonly headers: readonly string[];
  readonly rows: readonly ParsedRow[];
  readonly delimiter: string;
  readonly encoding: string;
  readonly rowCount: number;
  readonly columnCount: number;
  /**
   * Parallel to `headers`: true for every column whose original raw header
   * text collided with another column's, before disambiguation renamed it
   * (e.g. "Email" / "Email (2)"). The Header Engine uses this because the
   * renamed text no longer looks related on its own.
   */
  readonly headerDuplicateFlags: readonly boolean[];
}
