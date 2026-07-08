import { CRM_OUTPUT_FIELDS, type CrmOutputField } from "@/ai/schema/crm-output-schema";
import type { ExtractedRecord } from "@/pipeline/domain/extraction";

export interface SchemaValidationIssue {
  readonly field: string;
  readonly code: "MISSING_FIELD" | "UNKNOWN_FIELD" | "INVALID_TYPE";
  readonly message: string;
  readonly severity: "error" | "warning";
}

export interface SchemaValidationResult {
  readonly valid: boolean;
  readonly issues: readonly SchemaValidationIssue[];
  readonly missingFields: readonly string[];
  readonly unknownFields: readonly string[];
}

const KNOWN_FIELDS: ReadonlySet<string> = new Set(CRM_OUTPUT_FIELDS);

/**
 * Re-affirms the 15-field CRM contract on a record that has already passed
 * through `extraction-mapper.ts`'s structural mapping — by construction that
 * mapper always emits exactly `CRM_OUTPUT_FIELDS`, so this is defensive
 * ("never trust automatically") rather than expected to fire often: it
 * exists as the Trust Layer's own independent re-check, not a rewrite of the
 * mapper's job. Missing/wrong-typed fields are errors; a field the mapper
 * couldn't have produced (defensive only) is a warning.
 */
export function validateSchema(record: ExtractedRecord): SchemaValidationResult {
  const issues: SchemaValidationIssue[] = [];
  const missingFields: string[] = [];
  const unknownFields: string[] = [];
  const fieldsByName = new Map(record.fields.map((field) => [field.targetField, field]));

  for (const expected of CRM_OUTPUT_FIELDS) {
    const field = fieldsByName.get(expected);
    if (!field) {
      missingFields.push(expected);
      issues.push({
        field: expected,
        code: "MISSING_FIELD",
        message: `Required field "${expected}" is missing from the record.`,
        severity: "error",
      });
      continue;
    }
    if (field.value !== null && typeof field.value !== "string") {
      issues.push({
        field: expected,
        code: "INVALID_TYPE",
        message: `Field "${expected}" must be a string or null.`,
        severity: "error",
      });
    }
  }

  for (const field of record.fields) {
    if (!KNOWN_FIELDS.has(field.targetField)) {
      unknownFields.push(field.targetField);
      issues.push({
        field: field.targetField,
        code: "UNKNOWN_FIELD",
        message: `Field "${field.targetField}" is not part of the CRM output schema.`,
        severity: "warning",
      });
    }
  }

  return {
    valid: !issues.some((issue) => issue.severity === "error"),
    issues,
    missingFields,
    unknownFields,
  };
}

export function isKnownCrmField(field: string): field is CrmOutputField {
  return KNOWN_FIELDS.has(field);
}
