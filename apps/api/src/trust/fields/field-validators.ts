import { CRM_STATUS_VALUES, DATA_SOURCE_VALUES } from "@/ai/schema/crm-output-schema";
import { looksLikeDate, looksLikeEmail } from "@/pipeline/ingestion/pattern-detectors";
import type { ExtractedRecord } from "@/pipeline/domain/extraction";
import type { FieldValidationStatus } from "@/pipeline/domain/validation";

export interface FieldValidationOutcome {
  readonly field: string;
  readonly status: FieldValidationStatus;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COUNTRY_CODE_PATTERN = /^\+?\d{1,4}$/;
const MAX_FREE_TEXT_LENGTH = 2000;

/**
 * Validates one field's own value in isolation — format only, never a
 * cross-field or business-semantics check (that's
 * `business/business-rule-validator.ts`'s job). A `null` value is always
 * `"missing"` and never itself a violation; every one of the 15 fields is
 * allowed to be null per the assignment's own null-handling rule.
 */
export function validateField(field: string, value: string | null): FieldValidationOutcome {
  if (value === null) {
    return { field, status: "missing", warnings: [], errors: [] };
  }

  const trimmed = value.trim();
  const warnings: string[] = [];
  const errors: string[] = [];

  switch (field) {
    case "email":
      if (!looksLikeEmail(trimmed)) {
        errors.push(`"${value}" does not look like a valid email address.`);
      }
      break;

    case "created_at":
      if (!ISO_DATE_PATTERN.test(trimmed)) {
        if (looksLikeDate(trimmed)) {
          warnings.push(`"${value}" looks like a date but is not in ISO (YYYY-MM-DD) format.`);
        } else {
          errors.push(`"${value}" does not look like a valid date.`);
        }
      }
      break;

    case "country_code":
      if (!COUNTRY_CODE_PATTERN.test(trimmed)) {
        errors.push(`"${value}" does not look like a valid country calling code.`);
      }
      break;

    case "mobile_without_country_code": {
      const digits = trimmed.replace(/\D/g, "");
      if (digits.length < 7 || digits.length > 12) {
        errors.push(`"${value}" does not look like a valid phone number.`);
      } else if (digits.length !== trimmed.length) {
        warnings.push(`"${value}" contains non-digit formatting that should be normalized.`);
      }
      break;
    }

    case "crm_status":
      if (!(CRM_STATUS_VALUES as readonly string[]).includes(trimmed)) {
        errors.push(`"${value}" is not one of the allowed CRM status values.`);
      }
      break;

    case "data_source":
      if (!(DATA_SOURCE_VALUES as readonly string[]).includes(trimmed)) {
        errors.push(`"${value}" is not one of the allowed data source values.`);
      }
      break;

    default:
      if (trimmed.length === 0) {
        warnings.push(`"${field}" is present but empty after trimming.`);
      }
      if (trimmed.length > MAX_FREE_TEXT_LENGTH) {
        warnings.push(`"${field}" is unusually long (${trimmed.length} characters).`);
      }
      if (value !== trimmed) {
        warnings.push(`"${field}" has leading or trailing whitespace.`);
      }
      break;
  }

  const status: FieldValidationStatus = errors.length > 0 ? "invalid" : "valid";
  return { field, status, warnings, errors };
}

export function validateAllFields(record: ExtractedRecord): readonly FieldValidationOutcome[] {
  return record.fields.map((field) => validateField(field.targetField, field.value));
}
