import { describe, expect, it } from "vitest";
import { buildOutputSchema, buildOutputSchemaDescription } from "@/prompt/schema/schema-builder";
import {
  CRM_OUTPUT_FIELDS,
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
} from "@/ai/schema/crm-output-schema";

describe("buildOutputSchema", () => {
  it("produces one field entry per CRM_OUTPUT_FIELDS, all required and nullable", () => {
    const schema = buildOutputSchema();
    expect(schema.fields).toHaveLength(CRM_OUTPUT_FIELDS.length);
    for (const field of schema.fields) {
      expect(field.required).toBe(true);
      expect(field.nullable).toBe(true);
    }
  });

  it("marks crm_status and data_source as enum with the correct allowed values", () => {
    const schema = buildOutputSchema();
    const status = schema.fields.find((f) => f.name === "crm_status");
    const source = schema.fields.find((f) => f.name === "data_source");
    expect(status?.type).toBe("enum");
    expect(status?.enumValues).toEqual(CRM_STATUS_VALUES);
    expect(source?.type).toBe("enum");
    expect(source?.enumValues).toEqual(DATA_SOURCE_VALUES);
  });

  it("marks every other field as plain string", () => {
    const schema = buildOutputSchema();
    const nameField = schema.fields.find((f) => f.name === "name");
    expect(nameField?.type).toBe("string");
    expect(nameField?.enumValues).toBeUndefined();
  });

  it("defaults to OUTPUT_SCHEMA_VERSION but accepts an override", () => {
    expect(buildOutputSchema().version).toBe("v1.0");
    expect(buildOutputSchema("v2.0").version).toBe("v2.0");
  });
});

describe("buildOutputSchemaDescription", () => {
  it("lists every field and every enum value", () => {
    const description = buildOutputSchemaDescription();
    for (const field of CRM_OUTPUT_FIELDS) {
      expect(description).toContain(`"${field}"`);
    }
    for (const status of CRM_STATUS_VALUES) {
      expect(description).toContain(status);
    }
  });

  it("adds a strictness reminder only when supportsJsonMode is false", () => {
    const withJsonMode = buildOutputSchemaDescription(buildOutputSchema(), true);
    const withoutJsonMode = buildOutputSchemaDescription(buildOutputSchema(), false);
    expect(withJsonMode).not.toContain("no native JSON mode");
    expect(withoutJsonMode).toContain("no native JSON mode");
  });
});
