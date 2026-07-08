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

/** Dataset-level tally from the Normalization Engine's rule pipeline. */
export interface NormalizationReportDTO {
  readonly totalFields: number;
  readonly whitespaceNormalizedCount: number;
  readonly unicodeNormalizedCount: number;
  readonly nullValuesDetected: number;
  readonly emailsNormalized: number;
  readonly invalidEmails: number;
  readonly phonesNormalized: number;
  readonly invalidPhones: number;
  readonly datesParsed: number;
  readonly failedDateParses: number;
  readonly numbersNormalized: number;
  readonly booleansNormalized: number;
  readonly fieldsWithWarnings: number;
  readonly fieldsFailed: number;
}

export interface NormalizationFieldIssueDTO {
  readonly rowNumber: number;
  readonly header: string;
  readonly message: string;
  readonly status: "warning" | "failed";
}

/**
 * Preview-facing normalization summary — counts, a 0-100 health score, and a
 * capped list of human-readable field issues. Deliberately excludes rule ids
 * and per-rule structured detail (email/phone/date/number/boolean payloads):
 * those are internal to the engine, not part of the published contract.
 */
export interface NormalizationSummaryDTO {
  readonly report: NormalizationReportDTO;
  readonly healthScore: number;
  readonly fieldIssues: readonly NormalizationFieldIssueDTO[];
  /** May exceed fieldIssues.length if the list was capped. */
  readonly totalIssueCount: number;
  readonly warnings: readonly PreviewIssue[];
}

/** The Semantic Intelligence Engine's target vocabulary — see apps/api/src/semantic/types.ts. */
export type SemanticFieldId =
  | "name"
  | "email"
  | "phone"
  | "company"
  | "city"
  | "state"
  | "country"
  | "lead_owner"
  | "crm_status"
  | "crm_note"
  | "data_source"
  | "possession_time"
  | "description"
  | "created_at";

export type DatasetType =
  | "facebook_leads"
  | "google_ads"
  | "real_estate"
  | "marketing"
  | "sales"
  | "crm_export"
  | "manual_spreadsheet"
  | "mixed"
  | "unknown";

/**
 * Hybrid Mapping Engine's routing decision for one column:
 * "deterministic" — mapped without AI; "ai_candidate" — AI gets ranked hints;
 * "ai_required" — AI gets little more than the header; "unknown" — no
 * candidate field scored above the reporting floor at all.
 */
export type ConfidenceTier = "deterministic" | "ai_candidate" | "ai_required" | "unknown";

export interface SemanticFieldCandidateDTO {
  readonly fieldId: SemanticFieldId;
  readonly confidence: number;
}

/** Deterministic, AI-free field-mapping hint for one column — never a final CRM mapping. */
export interface SemanticColumnMappingDTO {
  readonly columnIndex: number;
  readonly header: string;
  readonly tier: ConfidenceTier;
  readonly topCandidateField: SemanticFieldId | null;
  readonly topCandidateConfidence: number;
  readonly alternateCandidates: readonly SemanticFieldCandidateDTO[];
}

/** Semantic Intelligence Engine's dataset-level summary, computed right after normalization. */
export interface SemanticReportDTO {
  readonly datasetType: DatasetType;
  readonly datasetTypeConfidence: number;
  readonly columnsAnalyzed: number;
  readonly columns: readonly SemanticColumnMappingDTO[];
  readonly highConfidenceCount: number;
  readonly mediumConfidenceCount: number;
  readonly aiRequiredCount: number;
  readonly unknownCount: number;
  /** Fraction of columns routed to "deterministic" or "ai_candidate". */
  readonly semanticCoverage: number;
  readonly averageConfidence: number;
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
  readonly normalization: NormalizationSummaryDTO;
  readonly semantics: SemanticReportDTO;
}
