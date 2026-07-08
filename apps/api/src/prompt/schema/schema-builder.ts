import {
  CRM_OUTPUT_FIELDS,
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
  OUTPUT_SCHEMA_VERSION,
  type CrmOutputField,
} from "@/ai/schema/crm-output-schema";

export interface OutputFieldSchema {
  readonly name: CrmOutputField;
  readonly type: "string" | "enum";
  readonly nullable: true;
  readonly required: true;
  readonly enumValues?: readonly string[];
}

/**
 * A real, structured representation of the output contract — never just a
 * hardcoded prose string. `buildOutputSchemaDescription` renders this into
 * prompt text; a future volume could just as easily render it as an actual
 * JSON Schema object for a provider with native structured-output support.
 */
export interface OutputSchema {
  readonly version: string;
  readonly fields: readonly OutputFieldSchema[];
  /** Structural shape of one record in the response, independent of field content. */
  readonly recordShape: string;
}

export function buildOutputSchema(version: string = OUTPUT_SCHEMA_VERSION): OutputSchema {
  const fields: OutputFieldSchema[] = CRM_OUTPUT_FIELDS.map((name) => {
    if (name === "crm_status") {
      return { name, type: "enum", nullable: true, required: true, enumValues: CRM_STATUS_VALUES };
    }
    if (name === "data_source") {
      return { name, type: "enum", nullable: true, required: true, enumValues: DATA_SOURCE_VALUES };
    }
    return { name, type: "string", nullable: true, required: true };
  });

  return {
    version,
    fields,
    recordShape:
      '{ "row": <row number>, "fields": { <each field>: { "value": string|null, "sourceHeader": string|null } } }',
  };
}

export function buildOutputSchemaDescription(
  schema: OutputSchema = buildOutputSchema(),
  supportsJsonMode: boolean = true,
): string {
  const fieldLines = schema.fields.map((field) => {
    const constraint =
      field.type === "enum" && field.enumValues
        ? `one of ${field.enumValues.map((v) => `"${v}"`).join(", ")}, or null`
        : "string or null";
    return `  - "${field.name}": ${constraint}`;
  });

  const strictnessReminder = supportsJsonMode
    ? ""
    : "\n\nThis provider has no native JSON mode — the ENTIRE response must be raw JSON with absolutely nothing else, not even a leading newline or a trailing sentence.";

  return (
    [
      `Return exactly one JSON object per input record, each shaped as: ${schema.recordShape}`,
      "",
      `The ${schema.fields.length} fields, every one of them required on every record:`,
      ...fieldLines,
      "",
      'Respond with a single JSON object: { "records": [ ... ] }. No markdown, no code fences, no commentary.',
    ].join("\n") + strictnessReminder
  );
}
