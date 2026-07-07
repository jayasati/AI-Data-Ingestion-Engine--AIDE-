/**
 * One cell after structural normalization. Both the original and normalized
 * value are retained — later stages (and audits) must be able to answer
 * "what did the source file actually say" without re-reading the upload.
 */
export interface NormalizedCell {
  readonly header: string;
  readonly originalValue: string;
  /** `null` once the value is recognized as an empty-token (e.g. "N/A", "--"). */
  readonly normalizedValue: string | null;
  readonly wasTrimmed: boolean;
  readonly wasEmptyNormalized: boolean;
}

export interface NormalizedRecord {
  readonly rowNumber: number;
  readonly cells: readonly NormalizedCell[];
}

/** Output of the Normalization stage: uniform representation, still schema-free. */
export interface NormalizedDataset {
  readonly headers: readonly string[];
  readonly records: readonly NormalizedRecord[];
  readonly recordCount: number;
}
