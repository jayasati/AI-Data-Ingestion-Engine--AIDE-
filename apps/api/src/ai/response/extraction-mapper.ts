import {
  CRM_OUTPUT_FIELDS,
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
  type CrmOutputField,
} from "@/ai/schema/crm-output-schema";
import type { StageIssue } from "@/pipeline/contracts/stage-result";
import type {
  ExtractedField,
  ExtractedRecord,
  SemanticExtractionResult,
} from "@/pipeline/domain/extraction";

export interface ExtractionValidationResult {
  readonly extraction: SemanticExtractionResult;
  readonly warnings: readonly StageIssue[];
}

interface RawFieldValue {
  readonly value: string | null;
  readonly sourceHeader: string | null;
}

/**
 * Structural validation of the AI's parsed JSON against the CRM output
 * schema — shape and enum membership only. This is the "Schema Validator"
 * step in the flow diagram, deliberately NOT the future Validation & Trust
 * Engine: an invalid crm_status becomes a warning and a null value here, it
 * never rejects the whole record or scores confidence beyond a trivial
 * present/absent flag — real confidence scoring is explicitly out of scope
 * this volume ("NO Confidence Engine").
 */
export function validateAndMapExtraction(data: unknown): ExtractionValidationResult {
  const warnings: StageIssue[] = [];

  if (!isRecordsContainer(data)) {
    warnings.push({
      code: "INVALID_RESPONSE_SHAPE",
      message: 'Expected a top-level object with a "records" array.',
    });
    return { extraction: { records: [] }, warnings };
  }

  const records: ExtractedRecord[] = [];
  for (const rawRecord of data.records) {
    const mapped = mapOneRecord(rawRecord, warnings);
    if (mapped) {
      records.push(mapped);
    }
  }

  return { extraction: { records }, warnings };
}

function isRecordsContainer(data: unknown): data is { records: readonly unknown[] } {
  return (
    typeof data === "object" &&
    data !== null &&
    Array.isArray((data as { records?: unknown }).records)
  );
}

function mapOneRecord(rawRecord: unknown, warnings: StageIssue[]): ExtractedRecord | null {
  if (typeof rawRecord !== "object" || rawRecord === null) {
    warnings.push({
      code: "INVALID_RECORD_SHAPE",
      message: "A record in the response was not an object; skipped.",
    });
    return null;
  }

  const candidate = rawRecord as { row?: unknown; fields?: unknown };
  const rowNumber = typeof candidate.row === "number" ? candidate.row : null;
  if (rowNumber === null) {
    warnings.push({
      code: "MISSING_ROW_NUMBER",
      message: 'A record was missing a numeric "row"; skipped.',
    });
    return null;
  }

  const rawFields =
    typeof candidate.fields === "object" && candidate.fields !== null
      ? (candidate.fields as Record<string, unknown>)
      : {};

  const fields: ExtractedField[] = CRM_OUTPUT_FIELDS.map((targetField) =>
    mapOneField(targetField, rawFields[targetField], rowNumber, warnings),
  );

  return { rowNumber, fields };
}

function mapOneField(
  targetField: CrmOutputField,
  rawField: unknown,
  rowNumber: number,
  warnings: StageIssue[],
): ExtractedField {
  const { value, sourceHeader } = extractValueAndSource(rawField);
  const enumIssueCode = checkEnumMembership(targetField, value);

  if (enumIssueCode) {
    warnings.push({
      code: enumIssueCode,
      message: `Row ${rowNumber}: "${targetField}" value "${value}" is not one of the allowed values; treated as null.`,
      context: { row: rowNumber, field: targetField, value },
    });
    return { sourceHeader: sourceHeader ?? "", targetField, value: null, confidence: 0 };
  }

  return {
    sourceHeader: sourceHeader ?? "",
    targetField,
    value,
    confidence: value !== null ? 1 : 0,
  };
}

/**
 * The prompt asks for `{ "value": string|null, "sourceHeader": string|null }`
 * per field, but real providers don't reliably follow a nested-object shape
 * described only in prose (`response_format: json_object` guarantees valid
 * JSON, not a specific structure) — observed live against gpt-4o-mini, which
 * got every value right but flattened `fields` to plain `{ name: "John Doe" }`
 * instead. Accepting a bare primitive here (in addition to the nested
 * object) means a provider that "simplifies" the shape still extracts
 * correctly; only `sourceHeader` is unrecoverable in that case, since a bare
 * value carries no provenance.
 */
function extractValueAndSource(rawField: unknown): RawFieldValue {
  if (typeof rawField === "string") {
    return { value: rawField, sourceHeader: null };
  }
  if (typeof rawField === "number" || typeof rawField === "boolean") {
    return { value: String(rawField), sourceHeader: null };
  }
  if (typeof rawField !== "object" || rawField === null) {
    return { value: null, sourceHeader: null };
  }
  const candidate = rawField as { value?: unknown; sourceHeader?: unknown };
  return {
    value: typeof candidate.value === "string" ? candidate.value : null,
    sourceHeader: typeof candidate.sourceHeader === "string" ? candidate.sourceHeader : null,
  };
}

function checkEnumMembership(field: CrmOutputField, value: string | null): string | null {
  if (value === null) {
    return null;
  }
  if (field === "crm_status" && !(CRM_STATUS_VALUES as readonly string[]).includes(value)) {
    return "INVALID_CRM_STATUS";
  }
  if (field === "data_source" && !(DATA_SOURCE_VALUES as readonly string[]).includes(value)) {
    return "INVALID_DATA_SOURCE";
  }
  return null;
}
