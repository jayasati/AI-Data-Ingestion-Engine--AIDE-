import { CRM_STATUS_VALUES, DATA_SOURCE_VALUES } from "@/ai/schema/crm-output-schema";
import { looksLikeDate } from "@/pipeline/ingestion/pattern-detectors";
import type { ExtractedRecord } from "@/pipeline/domain/extraction";

export interface BusinessRuleViolation {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
}

/** Shared with `repair/field-repair-engine.ts`, which uses the same shape to decide whether a single-value repair is safe to attempt. */
export const MULTI_VALUE_SPLIT_PATTERN = /[;,]|\s+(?:and|or)\s+/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function valueOf(record: ExtractedRecord, field: string): string | null {
  return record.fields.find((f) => f.targetField === field)?.value ?? null;
}

/**
 * Validates the assignment's named business rules — allowed enums, the
 * multiple-emails/multiple-phones overflow-to-crm_note rule, and the date
 * rule. Distinct from `fields/field-validators.ts`: that file checks one
 * field's own format in isolation, this file checks cross-field business
 * semantics (does an overflow value actually appear where the rule says it
 * should). Never decides to skip a record — that's `skip/skip-engine.ts`.
 */
export function validateBusinessRules(record: ExtractedRecord): readonly BusinessRuleViolation[] {
  const violations: BusinessRuleViolation[] = [];

  const status = valueOf(record, "crm_status");
  if (status !== null && !(CRM_STATUS_VALUES as readonly string[]).includes(status)) {
    violations.push({
      code: "INVALID_CRM_STATUS",
      message: `"${status}" is not an allowed crm_status value.`,
      severity: "error",
    });
  }

  const source = valueOf(record, "data_source");
  if (source !== null && !(DATA_SOURCE_VALUES as readonly string[]).includes(source)) {
    violations.push({
      code: "INVALID_DATA_SOURCE",
      message: `"${source}" is not an allowed data_source value.`,
      severity: "error",
    });
  }

  const crmNote = valueOf(record, "crm_note");
  const email = valueOf(record, "email");
  if (email !== null && MULTI_VALUE_SPLIT_PATTERN.test(email) && !crmNote) {
    violations.push({
      code: "MULTIPLE_EMAILS_NOT_IN_NOTE",
      message: `"email" ("${email}") looks like it carries more than one address; the extras should have been moved into crm_note.`,
      severity: "warning",
    });
  }

  const phone = valueOf(record, "mobile_without_country_code");
  if (phone !== null && MULTI_VALUE_SPLIT_PATTERN.test(phone) && !crmNote) {
    violations.push({
      code: "MULTIPLE_PHONES_NOT_IN_NOTE",
      message: `"mobile_without_country_code" ("${phone}") looks like it carries more than one number; the extras should have been moved into crm_note.`,
      severity: "warning",
    });
  }

  const createdAt = valueOf(record, "created_at");
  if (createdAt !== null && !ISO_DATE_PATTERN.test(createdAt) && !looksLikeDate(createdAt)) {
    violations.push({
      code: "INVALID_CREATED_AT",
      message: `"created_at" value "${createdAt}" is not parseable by a standard date parser.`,
      severity: "error",
    });
  }

  return violations;
}
