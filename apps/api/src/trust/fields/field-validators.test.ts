import { describe, expect, it } from "vitest";
import { validateAllFields, validateField } from "@/trust/fields/field-validators";
import type { ExtractedRecord } from "@/pipeline/domain/extraction";

describe("validateField", () => {
  it("treats null as 'missing', never a violation", () => {
    const result = validateField("email", null);
    expect(result.status).toBe("missing");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("accepts a well-formed email", () => {
    expect(validateField("email", "john@example.com").status).toBe("valid");
  });

  it("rejects a malformed email", () => {
    const result = validateField("email", "not-an-email");
    expect(result.status).toBe("invalid");
    expect(result.errors).toHaveLength(1);
  });

  it("accepts an ISO-format created_at", () => {
    expect(validateField("created_at", "2026-01-15").status).toBe("valid");
  });

  it("warns (not errors) on a date-shaped but non-ISO created_at", () => {
    const result = validateField("created_at", "15/01/2026");
    expect(result.status).toBe("valid");
    expect(result.warnings).toHaveLength(1);
  });

  it("errors on a created_at that doesn't look like a date at all", () => {
    const result = validateField("created_at", "not a date");
    expect(result.status).toBe("invalid");
    expect(result.errors).toHaveLength(1);
  });

  it("accepts a plausible country_code", () => {
    expect(validateField("country_code", "+91").status).toBe("valid");
    expect(validateField("country_code", "91").status).toBe("valid");
  });

  it("rejects an implausible country_code", () => {
    expect(validateField("country_code", "not-a-code").status).toBe("invalid");
  });

  it("accepts a plain-digit mobile_without_country_code", () => {
    expect(validateField("mobile_without_country_code", "9833311111").status).toBe("valid");
  });

  it("warns when mobile_without_country_code carries formatting noise", () => {
    const result = validateField("mobile_without_country_code", "983-331-1111");
    expect(result.status).toBe("valid");
    expect(result.warnings).toHaveLength(1);
  });

  it("rejects a mobile_without_country_code that's too short or too long", () => {
    expect(validateField("mobile_without_country_code", "123").status).toBe("invalid");
    expect(validateField("mobile_without_country_code", "1".repeat(20)).status).toBe("invalid");
  });

  it("accepts an allowed crm_status and rejects an unknown one", () => {
    expect(validateField("crm_status", "GOOD_LEAD_FOLLOW_UP").status).toBe("valid");
    expect(validateField("crm_status", "New").status).toBe("invalid");
  });

  it("accepts an allowed data_source and rejects an unknown one", () => {
    expect(validateField("data_source", "meridian_tower").status).toBe("valid");
    expect(validateField("data_source", "facebook").status).toBe("invalid");
  });

  it("warns on leading/trailing whitespace in a free-text field", () => {
    const result = validateField("company", "  Acme Corp  ");
    expect(result.status).toBe("valid");
    expect(result.warnings.some((w) => w.includes("whitespace"))).toBe(true);
  });

  it("warns on an unusually long free-text field", () => {
    const result = validateField("description", "x".repeat(2001));
    expect(result.warnings.some((w) => w.includes("unusually long"))).toBe(true);
  });
});

describe("validateAllFields", () => {
  it("validates every field on a record independently", () => {
    const record: ExtractedRecord = {
      rowNumber: 1,
      fields: [
        { sourceHeader: "Email", targetField: "email", value: "john@example.com", confidence: 1 },
        { sourceHeader: "Status", targetField: "crm_status", value: "New", confidence: 1 },
      ],
    };
    const outcomes = validateAllFields(record);
    expect(outcomes).toHaveLength(2);
    expect(outcomes.find((o) => o.field === "email")?.status).toBe("valid");
    expect(outcomes.find((o) => o.field === "crm_status")?.status).toBe("invalid");
  });
});
