import { describe, expect, it } from "vitest";
import { validateBusinessRules } from "@/trust/business/business-rule-validator";
import type { ExtractedField, ExtractedRecord } from "@/pipeline/domain/extraction";

function record(fields: Partial<Record<string, string | null>>): ExtractedRecord {
  const mapped: ExtractedField[] = Object.entries(fields).map(([targetField, value]) => ({
    sourceHeader: "",
    targetField,
    value: value ?? null,
    confidence: value ? 1 : 0,
  }));
  return { rowNumber: 1, fields: mapped };
}

describe("validateBusinessRules", () => {
  it("has no violations for a fully compliant record", () => {
    const violations = validateBusinessRules(
      record({
        crm_status: "GOOD_LEAD_FOLLOW_UP",
        data_source: "meridian_tower",
        created_at: "2026-01-15",
        email: "john@example.com",
      }),
    );
    expect(violations).toEqual([]);
  });

  it("flags an invalid crm_status as an error", () => {
    const violations = validateBusinessRules(record({ crm_status: "New" }));
    expect(violations).toContainEqual(
      expect.objectContaining({ code: "INVALID_CRM_STATUS", severity: "error" }),
    );
  });

  it("flags an invalid data_source as an error", () => {
    const violations = validateBusinessRules(record({ data_source: "facebook" }));
    expect(violations).toContainEqual(
      expect.objectContaining({ code: "INVALID_DATA_SOURCE", severity: "error" }),
    );
  });

  it("flags multiple emails not carried into crm_note as a warning", () => {
    const violations = validateBusinessRules(
      record({ email: "a@example.com, b@example.com", crm_note: null }),
    );
    expect(violations).toContainEqual(
      expect.objectContaining({ code: "MULTIPLE_EMAILS_NOT_IN_NOTE", severity: "warning" }),
    );
  });

  it("does not flag multiple emails when crm_note already carries the overflow", () => {
    const violations = validateBusinessRules(
      record({
        email: "a@example.com, b@example.com",
        crm_note: "Additional email: b@example.com",
      }),
    );
    expect(violations.some((v) => v.code === "MULTIPLE_EMAILS_NOT_IN_NOTE")).toBe(false);
  });

  it("flags multiple phones not carried into crm_note as a warning", () => {
    const violations = validateBusinessRules(
      record({ mobile_without_country_code: "9876543210, 9876543211" }),
    );
    expect(violations).toContainEqual(
      expect.objectContaining({ code: "MULTIPLE_PHONES_NOT_IN_NOTE", severity: "warning" }),
    );
  });

  it("flags a created_at that isn't parseable by a standard date parser as an error", () => {
    const violations = validateBusinessRules(record({ created_at: "whenever" }));
    expect(violations).toContainEqual(
      expect.objectContaining({ code: "INVALID_CREATED_AT", severity: "error" }),
    );
  });

  it("does not flag a non-ISO but date-shaped created_at (that's a field-level warning, not a business error)", () => {
    const violations = validateBusinessRules(record({ created_at: "15/01/2026" }));
    expect(violations.some((v) => v.code === "INVALID_CREATED_AT")).toBe(false);
  });

  it("treats null fields as compliant (nulls are always allowed)", () => {
    const violations = validateBusinessRules(record({ crm_status: null, email: null }));
    expect(violations).toEqual([]);
  });
});
