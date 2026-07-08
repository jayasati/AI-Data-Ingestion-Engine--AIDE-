import type { StageIssue } from "@/pipeline/contracts/stage-result";

/**
 * "unchanged": no rule matched or changed anything (already-clean plain text).
 * "normalized": one or more rules changed the value deterministically.
 * "warning": a rule matched but could not fully resolve the value (e.g. an
 *   ambiguous date, a phone with no determinable country) — the original or
 *   a best-effort value is preserved rather than guessed.
 * "failed": a rule itself threw during normalization, caught defensively by
 *   the engine. Should not occur in normal operation; reserved for genuine
 *   internal errors, never for merely-invalid-looking data (that's "warning").
 */
export type NormalizationStatus = "unchanged" | "normalized" | "warning" | "failed";

export interface EmailFieldDetails {
  readonly kind: "email";
  readonly primary: string;
  /** Extra emails found in the same cell (comma/semicolon separated), for future CRM-note handling. */
  readonly additional: readonly string[];
  readonly isValid: boolean;
}

export interface PhoneFieldDetails {
  readonly kind: "phone";
  /** E.164 form, only when a country could be determined with confidence. */
  readonly e164: string | null;
  readonly countryCode: string | null;
  readonly nationalNumber: string;
  readonly raw: string;
  readonly additional: readonly string[];
}

export interface DateFieldDetails {
  readonly kind: "date";
  /** ISO 8601 date (YYYY-MM-DD), only when the format was unambiguous. */
  readonly iso: string | null;
  readonly matchedFormat: string | null;
}

export interface NumberFieldDetails {
  readonly kind: "number";
  readonly value: number | null;
  readonly currencySymbol: string | null;
  readonly isPercentage: boolean;
}

export interface BooleanFieldDetails {
  readonly kind: "boolean";
  readonly value: boolean | null;
}

export type NormalizedFieldDetails =
  | EmailFieldDetails
  | PhoneFieldDetails
  | DateFieldDetails
  | NumberFieldDetails
  | BooleanFieldDetails;

/**
 * Everything known about one cell after the rule pipeline ran. Both the
 * original and canonical values are always retained — an audit or a future
 * review UI must be able to answer "what did the source file actually say."
 */
export interface NormalizedField {
  readonly header: string;
  readonly originalValue: string;
  readonly normalizedValue: string | null;
  /** Rule ids that changed the value, in execution order (e.g. ["unicode", "whitespace", "email"]). */
  readonly appliedRules: readonly string[];
  readonly warnings: readonly StageIssue[];
  readonly status: NormalizationStatus;
  /** 0-1. 1 = fully confident (exact match / unambiguous parse). */
  readonly confidence: number;
  /** Present only for content-shape rules (email/phone/date/number/boolean). */
  readonly details?: NormalizedFieldDetails;
}

export interface NormalizedRecord {
  readonly rowNumber: number;
  readonly fields: readonly NormalizedField[];
  /** Rollup of every field's warnings on this row. */
  readonly warnings: readonly StageIssue[];
  readonly hasErrors: boolean;
}

/** Dataset-level tally, per the volume's named report fields. */
export interface NormalizationReport {
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

/** Output of the Normalization stage: canonical representation, still schema-free. */
export interface NormalizedDataset {
  readonly headers: readonly string[];
  readonly records: readonly NormalizedRecord[];
  readonly recordCount: number;
  readonly report: NormalizationReport;
}
