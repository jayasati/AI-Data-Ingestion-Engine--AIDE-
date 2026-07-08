/**
 * The 15-field canonical CRM schema, per the GrowEasy assignment spec. This
 * is a structural contract only — what shape the AI must return — never a
 * business-rule validator (no "skip if no email/phone", no confidence
 * scoring; those belong to the future Validation & Trust Engine volume).
 */
export const CRM_OUTPUT_FIELDS = [
  "created_at",
  "name",
  "email",
  "country_code",
  "mobile_without_country_code",
  "company",
  "city",
  "state",
  "country",
  "lead_owner",
  "crm_status",
  "crm_note",
  "data_source",
  "possession_time",
  "description",
] as const;

export type CrmOutputField = (typeof CRM_OUTPUT_FIELDS)[number];

export const CRM_STATUS_VALUES = [
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE",
] as const;

export const DATA_SOURCE_VALUES = [
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots",
] as const;

export const OUTPUT_SCHEMA_VERSION = "v1.0";

/**
 * Human/AI-readable description of the output contract, injected into the
 * prompt's Output Schema section. Kept as plain text (not a JSON Schema
 * object) because that is what a chat-completion prompt actually consumes —
 * the structural shape itself is enforced afterward by schema-validator.ts.
 */
export function buildOutputSchemaDescription(): string {
  const fieldLines = CRM_OUTPUT_FIELDS.map((field) => {
    if (field === "crm_status") {
      return `  - "${field}": one of ${CRM_STATUS_VALUES.map((v) => `"${v}"`).join(", ")}, or null`;
    }
    if (field === "data_source") {
      return `  - "${field}": one of ${DATA_SOURCE_VALUES.map((v) => `"${v}"`).join(", ")}, or null`;
    }
    return `  - "${field}": string or null`;
  }).join("\n");

  return [
    "Return exactly one JSON object per input record, each shaped as:",
    '{ "row": <the record\'s row number>, "fields": { <each of the 15 fields below, each as { "value": string|null, "sourceHeader": string|null } > } }',
    "",
    "The 15 fields, every one of them required on every record:",
    fieldLines,
    "",
    'Respond with a single JSON object: { "records": [ ... ] }. No markdown, no code fences, no commentary.',
  ].join("\n");
}
