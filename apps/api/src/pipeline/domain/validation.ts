/**
 * Populated by the Trust Layer (`@/trust`) — this file only defines the
 * shape; `trust/trust-engine.ts` is what actually produces these values.
 * Kept in `pipeline/domain` (not `@/trust`) for the same reason
 * `extraction.ts` sits here: domain types stay dependency-free so a
 * higher-level module (`@/trust`, like `@/ai` before it) can depend on them,
 * never the reverse.
 */

/** Four outcomes a record can land on — never more, never fewer, mirroring StageOutcome's own philosophy. */
export type ApprovalStatus = "approved" | "needs_review" | "rejected" | "skipped";

/** Per-field validation outcome, independent of whether a repair was attempted. */
export type FieldValidationStatus = "valid" | "repaired" | "invalid" | "missing";

export type RepairStatus = "not_repaired" | "repaired" | "repair_failed";

/** Which stage of the Trust Pipeline an issue originated in — see trust/errors/error-classification.ts. */
export type TrustErrorCategory =
  "parser" | "schema" | "validation" | "business" | "repair" | "approval";

export interface ClassifiedIssue {
  readonly category: TrustErrorCategory;
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
}

/**
 * One deterministic transformation the Repair Engine applied to a field.
 * Repair only ever transforms an existing value — `originalValue` is never
 * null here (a null field is left null; the Repair Engine never invents data).
 */
export interface RepairAction {
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

/** Per-field diagnostic — the "Per Field" tier of the Validation Report. */
export interface FieldValidationReport {
  readonly field: string;
  readonly value: string | null;
  readonly originalValue: string | null;
  readonly validationStatus: FieldValidationStatus;
  readonly repairStatus: RepairStatus;
  readonly confidence: number;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

export interface SkipDecision {
  readonly skipped: boolean;
  readonly reason: string | null;
}

/**
 * Shape the Validation stage produces — the Trust Layer's per-record
 * verdict. `isValid`/`confidenceScore`/`issues` are the original placeholder
 * fields (kept so nothing that reads them needs to change); everything else
 * is additive, populated by `trust/trust-engine.ts`.
 */
export interface ValidatedRecord {
  readonly rowNumber: number;
  /** True unless `approvalStatus === "rejected"`. */
  readonly isValid: boolean;
  /** Record-level confidence, 0-1 — see trust/confidence/confidence-engine.ts. */
  readonly confidenceScore: number;
  /** Flat, human-readable messages — every warning/error across every field, for quick display. */
  readonly issues: readonly string[];
  readonly approvalStatus: ApprovalStatus;
  readonly approvalReason: string;
  /** 0-100 — see trust/quality/quality-score.ts. */
  readonly qualityScore: number;
  readonly skipped: boolean;
  readonly skipReason: string | null;
  readonly repairCount: number;
  readonly repairsApplied: readonly RepairAction[];
  readonly fields: readonly FieldValidationReport[];
  readonly classifiedIssues: readonly ClassifiedIssue[];
}

/** The "Per Dataset" tier of the Validation Report. */
export interface DatasetValidationSummary {
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

export interface ValidationResult {
  readonly records: readonly ValidatedRecord[];
  readonly summary: DatasetValidationSummary;
}
