import { describe, expect, it } from "vitest";
import { CRM_OUTPUT_FIELDS } from "@/ai/schema/crm-output-schema";
import { validateAndMapExtraction } from "@/ai/response/extraction-mapper";

describe("validateAndMapExtraction", () => {
  it("maps every one of the 15 CRM_OUTPUT_FIELDS for a valid records shape", () => {
    const data = {
      records: [
        {
          row: 1,
          fields: {
            name: { value: "John Doe", sourceHeader: "Full Name" },
            email: { value: "john@example.com", sourceHeader: "Email" },
          },
        },
      ],
    };

    const result = validateAndMapExtraction(data);
    expect(result.warnings).toHaveLength(0);
    expect(result.extraction.records).toHaveLength(1);
    const record = result.extraction.records[0];
    expect(record.rowNumber).toBe(1);
    expect(record.fields).toHaveLength(CRM_OUTPUT_FIELDS.length);
    expect(record.fields.map((f) => f.targetField).sort()).toEqual([...CRM_OUTPUT_FIELDS].sort());

    const nameField = record.fields.find((f) => f.targetField === "name");
    expect(nameField?.value).toBe("John Doe");
    expect(nameField?.sourceHeader).toBe("Full Name");
    expect(nameField?.confidence).toBe(1);
  });

  it("produces INVALID_RESPONSE_SHAPE and empty records when 'records' is missing", () => {
    const result = validateAndMapExtraction({ notRecords: [] });
    expect(result.extraction.records).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].code).toBe("INVALID_RESPONSE_SHAPE");
  });

  it("produces INVALID_RESPONSE_SHAPE for non-object input", () => {
    const result = validateAndMapExtraction("just a string");
    expect(result.extraction.records).toHaveLength(0);
    expect(result.warnings[0].code).toBe("INVALID_RESPONSE_SHAPE");
  });

  it("skips a record missing a numeric row with MISSING_ROW_NUMBER", () => {
    const result = validateAndMapExtraction({ records: [{ fields: {} }] });
    expect(result.extraction.records).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].code).toBe("MISSING_ROW_NUMBER");
  });

  it("skips a non-object record with INVALID_RECORD_SHAPE", () => {
    const result = validateAndMapExtraction({ records: ["not an object"] });
    expect(result.extraction.records).toHaveLength(0);
    expect(result.warnings[0].code).toBe("INVALID_RECORD_SHAPE");
  });

  it("nulls an invalid crm_status enum value and warns INVALID_CRM_STATUS, without rejecting the record", () => {
    const result = validateAndMapExtraction({
      records: [{ row: 1, fields: { crm_status: { value: "New", sourceHeader: "Status" } } }],
    });
    expect(result.extraction.records).toHaveLength(1);
    const field = result.extraction.records[0].fields.find((f) => f.targetField === "crm_status");
    expect(field?.value).toBeNull();
    expect(field?.confidence).toBe(0);
    expect(result.warnings.map((w) => w.code)).toContain("INVALID_CRM_STATUS");
  });

  it("nulls an invalid data_source enum value and warns INVALID_DATA_SOURCE", () => {
    const result = validateAndMapExtraction({
      records: [
        { row: 1, fields: { data_source: { value: "unknown_source", sourceHeader: "Source" } } },
      ],
    });
    const field = result.extraction.records[0].fields.find((f) => f.targetField === "data_source");
    expect(field?.value).toBeNull();
    expect(result.warnings.map((w) => w.code)).toContain("INVALID_DATA_SOURCE");
  });

  it("accepts a valid crm_status enum value with no warning", () => {
    const result = validateAndMapExtraction({
      records: [{ row: 1, fields: { crm_status: { value: "SALE_DONE", sourceHeader: "Status" } } }],
    });
    const field = result.extraction.records[0].fields.find((f) => f.targetField === "crm_status");
    expect(field?.value).toBe("SALE_DONE");
    expect(field?.confidence).toBe(1);
    expect(result.warnings).toHaveLength(0);
  });

  it("maps a missing sourceHeader to an empty string, never null (ExtractedField.sourceHeader is non-nullable)", () => {
    const result = validateAndMapExtraction({
      records: [{ row: 1, fields: { name: { value: "John" } } }],
    });
    const field = result.extraction.records[0].fields.find((f) => f.targetField === "name");
    expect(field?.sourceHeader).toBe("");
  });

  it("maps a missing field entirely to value null, sourceHeader '', confidence 0", () => {
    const result = validateAndMapExtraction({ records: [{ row: 1, fields: {} }] });
    const field = result.extraction.records[0].fields.find((f) => f.targetField === "email");
    expect(field?.value).toBeNull();
    expect(field?.sourceHeader).toBe("");
    expect(field?.confidence).toBe(0);
  });

  it("handles fields being a non-object by treating every field as absent", () => {
    const result = validateAndMapExtraction({ records: [{ row: 1, fields: "not an object" }] });
    expect(result.extraction.records).toHaveLength(1);
    expect(result.extraction.records[0].fields.every((f) => f.value === null)).toBe(true);
  });
});
