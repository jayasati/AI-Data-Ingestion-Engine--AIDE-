/** A single warning or diagnostic surfaced by the AI Orchestration Platform. */
export interface AIExtractIssueDTO {
  readonly code: string;
  readonly message: string;
}

export interface AITokenUsageDTO {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

export type AIExecutionStatusDTO =
  "success" | "parser_error" | "provider_error" | "timeout" | "compilation_error";

/** Whether the JSON Repair Engine had to intervene before the AI response could be parsed. */
export interface JsonRepairMetadataDTO {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly repairsApplied: readonly string[];
}

/**
 * Observability for how ONE prompt was compiled by the Prompt Engineering
 * Platform — version, template, examples selected, size, token estimate,
 * timing, and validation warnings. Never the compiled prompt text itself.
 */
export interface PromptExecutionMetadataDTO {
  readonly promptVersion: string;
  readonly promptHash: string;
  readonly templateId: string;
  readonly examplesUsed: readonly string[];
  readonly negativeExamplesUsed: readonly string[];
  readonly contextSizeChars: number;
  readonly estimatedPromptTokens: number;
  readonly estimatedCompletionTokens: number;
  readonly estimatedCostUsd: number | null;
  readonly compilationTimeMs: number;
  readonly validationWarnings: readonly string[];
}

/**
 * Observability record for one AI call — provider, model, prompt/schema
 * version, timing, tokens, estimated cost, and diagnostics. Deliberately
 * never includes the compiled prompt or raw provider response text.
 */
export interface AIExecutionReportDTO {
  readonly requestId: string;
  readonly provider: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly schemaVersion: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly latencyMs: number;
  readonly tokenUsage: AITokenUsageDTO;
  /** null when the provider/model pricing isn't known (e.g. Mock). */
  readonly estimatedCostUsd: number | null;
  readonly status: AIExecutionStatusDTO;
  readonly warnings: readonly AIExtractIssueDTO[];
  readonly parserDiagnostics: readonly AIExtractIssueDTO[];
  /** Null only when `status === "compilation_error"` — the prompt never finished compiling. */
  readonly promptMetadata: PromptExecutionMetadataDTO | null;
  readonly repairMetadata: JsonRepairMetadataDTO;
}

export interface ExtractedFieldDTO {
  readonly sourceHeader: string;
  readonly targetField: string;
  readonly value: string | null;
  readonly confidence: number;
}

export interface ExtractedRecordDTO {
  readonly rowNumber: number;
  readonly fields: readonly ExtractedFieldDTO[];
}

/** Trust Layer verdict — see packages/shared-types and apps/api/src/trust/README.md. */
export type ApprovalStatusDTO = "approved" | "needs_review" | "rejected" | "skipped";
export type FieldValidationStatusDTO = "valid" | "repaired" | "invalid" | "missing";
export type RepairStatusDTO = "not_repaired" | "repaired" | "repair_failed";
export type TrustErrorCategoryDTO =
  "parser" | "schema" | "validation" | "business" | "repair" | "approval";

export interface ClassifiedIssueDTO {
  readonly category: TrustErrorCategoryDTO;
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
}

export interface RepairActionDTO {
  readonly field: string;
  readonly kind:
    | "trim_whitespace"
    | "normalize_email"
    | "normalize_phone"
    | "normalize_date"
    | "enum_closest_match"
    | "drop_unknown_field";
  readonly originalValue: string;
  readonly repairedValue: string | null;
  readonly reason: string;
}

export interface FieldValidationReportDTO {
  readonly field: string;
  readonly value: string | null;
  readonly originalValue: string | null;
  readonly validationStatus: FieldValidationStatusDTO;
  readonly repairStatus: RepairStatusDTO;
  readonly confidence: number;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

/** One record's full Trust Layer verdict — the "Per Record" tier of the Validation Report. */
export interface ValidatedRecordDTO {
  readonly rowNumber: number;
  readonly isValid: boolean;
  readonly confidenceScore: number;
  readonly issues: readonly string[];
  readonly approvalStatus: ApprovalStatusDTO;
  readonly approvalReason: string;
  readonly qualityScore: number;
  readonly skipped: boolean;
  readonly skipReason: string | null;
  readonly repairCount: number;
  readonly repairsApplied: readonly RepairActionDTO[];
  readonly fields: readonly FieldValidationReportDTO[];
  readonly classifiedIssues: readonly ClassifiedIssueDTO[];
}

/** The "Per Dataset" tier of the Validation Report — dataset health at a glance. */
export interface DatasetValidationSummaryDTO {
  readonly totalRecords: number;
  readonly approvedCount: number;
  readonly needsReviewCount: number;
  readonly rejectedCount: number;
  readonly skippedCount: number;
  readonly averageConfidence: number;
  readonly averageQualityScore: number;
  readonly totalRepairs: number;
  readonly recordsWithRepairs: number;
}

export interface ValidationResultDTO {
  readonly records: readonly ValidatedRecordDTO[];
  readonly summary: DatasetValidationSummaryDTO;
}

export interface AIExtractResponse {
  readonly implemented: true;
  readonly records: readonly ExtractedRecordDTO[];
  readonly recordCount: number;
  readonly validation: ValidationResultDTO;
  readonly report: AIExecutionReportDTO;
}
