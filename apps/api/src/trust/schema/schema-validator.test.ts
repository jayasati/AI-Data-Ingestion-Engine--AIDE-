import { describe, expect, it } from "vitest";
import { CRM_OUTPUT_FIELDS } from "@/ai/schema/crm-output-schema";
import { validateSchema } from "@/trust/schema/schema-validator";
import type { ExtractedField, ExtractedRecord } from "@/pipeline/domain/extraction";

function allNullFields(): ExtractedField[] {
  return CRM_OUTPUT_FIELDS.map((targetField) => ({
    sourceHeader: "",
    targetField,
    value: null,
    confidence: 0,
  }));
}

describe("validateSchema", () => {
  it("is valid for a record carrying every CRM field, even when every value is null", () => {
    const record: ExtractedRecord = { rowNumber: 1, fields: allNullFields() };
    const result = validateSchema(record);
    expect(result.valid).toBe(true);
    expect(result.missingFields).toEqual([]);
    expect(result.unknownFields).toEqual([]);
  });

  it("flags a missing required field as an error", () => {
    const fields = allNullFields().filter((f) => f.targetField !== "email");
    const record: ExtractedRecord = { rowNumber: 1, fields };
    const result = validateSchema(record);
    expect(result.valid).toBe(false);
    expect(result.missingFields).toEqual(["email"]);
    expect(result.issues[0].code).toBe("MISSING_FIELD");
    expect(result.issues[0].severity).toBe("error");
  });

  it("flags a field outside the CRM schema as an unknown-field warning, not an error", () => {
    const fields = [
      ...allNullFields(),
      { sourceHeader: "Extra", targetField: "unexpected_field", value: "x", confidence: 1 },
    ];
    const record: ExtractedRecord = { rowNumber: 1, fields };
    const result = validateSchema(record);
    expect(result.valid).toBe(true);
    expect(result.unknownFields).toEqual(["unexpected_field"]);
    expect(result.issues.find((i) => i.code === "UNKNOWN_FIELD")?.severity).toBe("warning");
  });

  it("flags a non-string, non-null value as an invalid-type error", () => {
    const fields = allNullFields().map((f) =>
      f.targetField === "name" ? { ...f, value: 42 as unknown as string } : f,
    );
    const record: ExtractedRecord = { rowNumber: 1, fields };
    const result = validateSchema(record);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "INVALID_TYPE" && i.field === "name")).toBe(true);
  });
});
