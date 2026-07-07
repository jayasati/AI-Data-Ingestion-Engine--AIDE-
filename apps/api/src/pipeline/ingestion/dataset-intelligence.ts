import type { ColumnDataTypeGuess, ColumnProfile } from "@/pipeline/ingestion/column-profiler";

export interface ColumnHint {
  readonly columnIndex: number;
  readonly header: string;
  readonly confidence: number;
}

/**
 * Grouped, derived view over ColumnProfile — a pure projection, not an
 * independent analysis. These are hints for a human or a future prompt to
 * read; they never become a CRM field mapping.
 */
export interface DatasetIntelligence {
  readonly likelyEmailColumns: readonly ColumnHint[];
  readonly likelyPhoneColumns: readonly ColumnHint[];
  readonly likelyDateColumns: readonly ColumnHint[];
  readonly likelyNumericColumns: readonly ColumnHint[];
  readonly likelyTextColumns: readonly ColumnHint[];
}

export function buildDatasetIntelligence(
  columnProfiles: readonly ColumnProfile[],
): DatasetIntelligence {
  const pick = (type: ColumnDataTypeGuess): ColumnHint[] =>
    columnProfiles
      .filter((profile) => profile.dataTypeGuess === type)
      .map((profile) => ({
        columnIndex: profile.columnIndex,
        header: profile.originalHeader,
        confidence: profile.confidenceScore,
      }));

  return {
    likelyEmailColumns: pick("email"),
    likelyPhoneColumns: pick("phone"),
    likelyDateColumns: pick("date"),
    likelyNumericColumns: pick("numeric"),
    likelyTextColumns: pick("text"),
  };
}
