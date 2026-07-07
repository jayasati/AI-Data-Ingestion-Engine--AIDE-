/** A single warning or error surfaced by the parser, at run- or row-level. */
export interface PreviewIssue {
  readonly code: string;
  readonly message: string;
}

export interface HeaderProfileDTO {
  readonly columnIndex: number;
  readonly originalHeader: string;
  readonly normalizedHeader: string;
  /** True if another column normalizes to the same name (e.g. "Email" and "email-address"). */
  readonly isDuplicate: boolean;
}

export type ColumnDataTypeGuess = "email" | "phone" | "date" | "numeric" | "text" | "empty";

export interface ColumnDetectedPatterns {
  readonly potentialEmail: boolean;
  readonly potentialPhone: boolean;
  readonly potentialDate: boolean;
  readonly potentialNumeric: boolean;
}

/** Deterministic, AI-free profile of one column's values. A hint, never a CRM field mapping. */
export interface ColumnProfileDTO {
  readonly columnIndex: number;
  readonly originalHeader: string;
  readonly normalizedHeader: string;
  readonly isDuplicateHeader: boolean;
  readonly dataTypeGuess: ColumnDataTypeGuess;
  /** 0-1 confidence in `dataTypeGuess`, based on the match ratio of the winning pattern. */
  readonly confidenceScore: number;
  readonly uniqueValueCount: number;
  readonly missingValueCount: number;
  readonly nullPercentage: number;
  readonly averageLength: number;
  readonly maxLength: number;
  readonly minLength: number;
  readonly sampleValues: readonly string[];
  readonly detectedPatterns: ColumnDetectedPatterns;
}

export type DatasetComplexity = "low" | "medium" | "high";

/**
 * Parse-time structural quality score (0-100). Distinct from the future
 * Validation & Trust Engine's confidence scoring — this measures how cleanly
 * the file parsed, not whether the data is semantically correct.
 */
export interface DatasetMetadataDTO {
  readonly totalRows: number;
  readonly totalColumns: number;
  readonly duplicateHeaderCount: number;
  readonly delimiter: string;
  readonly encoding: string;
  readonly blankRowCount: number;
  readonly malformedRowCount: number;
  readonly missingCellCount: number;
  readonly estimatedComplexity: DatasetComplexity;
  readonly datasetSizeBytes: number;
  readonly estimatedMemoryUsageBytes: number;
  readonly dataQualityScore: number;
}

export interface ColumnHintDTO {
  readonly columnIndex: number;
  readonly header: string;
  readonly confidence: number;
}

/** Grouped, derived view over ColumnProfileDTO — hints only, never CRM mapping. */
export interface DatasetIntelligenceDTO {
  readonly likelyEmailColumns: readonly ColumnHintDTO[];
  readonly likelyPhoneColumns: readonly ColumnHintDTO[];
  readonly likelyDateColumns: readonly ColumnHintDTO[];
  readonly likelyNumericColumns: readonly ColumnHintDTO[];
  readonly likelyTextColumns: readonly ColumnHintDTO[];
}

export interface PreviewRowDTO {
  readonly rowNumber: number;
  readonly cells: readonly string[];
  readonly status: "ok" | "recovered";
  readonly warnings: readonly PreviewIssue[];
}

export interface DatasetPreviewResponse {
  readonly implemented: true;
  readonly previewRowCount: number;
  readonly totalRowCount: number;
  readonly headers: readonly HeaderProfileDTO[];
  readonly rows: readonly PreviewRowDTO[];
  readonly datasetMetadata: DatasetMetadataDTO;
  readonly columnProfiles: readonly ColumnProfileDTO[];
  readonly datasetIntelligence: DatasetIntelligenceDTO;
  readonly warnings: readonly PreviewIssue[];
}
