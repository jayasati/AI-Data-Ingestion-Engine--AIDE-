import { describe, expect, it } from "vitest";
import { repairField } from "@/trust/repair/field-repair-engine";

describe("repairField", () => {
  it("never touches a null value", () => {
    const result = repairField("email", null);
    expect(result.value).toBeNull();
    expect(result.action).toBeNull();
  });

  it("repairs a near-miss crm_status to the closest allowed value", () => {
    const result = repairField("crm_status", "good_lead_follow_up");
    expect(result.value).toBe("GOOD_LEAD_FOLLOW_UP");
    expect(result.action?.kind).toBe("enum_closest_match");
  });

  it("does not guess a crm_status that is too far from every allowed value", () => {
    const result = repairField("crm_status", "totally unrelated garbage");
    expect(result.value).toBe("totally unrelated garbage");
    expect(result.action).toBeNull();
  });

  it("leaves an already-valid crm_status untouched", () => {
    const result = repairField("crm_status", "SALE_DONE");
    expect(result.action).toBeNull();
  });

  it("repairs a near-miss data_source to the closest allowed value", () => {
    const result = repairField("data_source", "meridian tower");
    expect(result.value).toBe("meridian_tower");
    expect(result.action?.kind).toBe("enum_closest_match");
  });

  it("normalizes email casing and whitespace", () => {
    const result = repairField("email", "  John@Example.COM ");
    expect(result.value).toBe("john@example.com");
    expect(result.action?.kind).toBe("normalize_email");
  });

  it("does not attempt to repair a multi-value email field", () => {
    const result = repairField("email", "a@example.com, b@example.com");
    expect(result.action).toBeNull();
    expect(result.value).toBe("a@example.com, b@example.com");
  });

  it("strips formatting noise from a phone number", () => {
    const result = repairField("mobile_without_country_code", "983-331-1111");
    expect(result.value).toBe("9833311111");
    expect(result.action?.kind).toBe("normalize_phone");
  });

  it("never injects a country code into mobile_without_country_code", () => {
    const result = repairField("mobile_without_country_code", "983 331 1111");
    expect(result.value).toBe("9833311111");
    expect(result.value?.startsWith("+")).toBe(false);
  });

  it("does not attempt to repair a multi-value phone field", () => {
    const result = repairField("mobile_without_country_code", "9876543210, 9876543211");
    expect(result.action).toBeNull();
  });

  it("normalizes a non-ISO date to ISO 8601", () => {
    const result = repairField("created_at", "15-Jan-2026");
    expect(result.value).toBe("2026-01-15");
    expect(result.action?.kind).toBe("normalize_date");
  });

  it("leaves an already-ISO date untouched", () => {
    const result = repairField("created_at", "2026-01-15");
    expect(result.action).toBeNull();
  });

  it("falls back to trimming whitespace for a generic free-text field", () => {
    const result = repairField("company", "  Acme Corp  ");
    expect(result.value).toBe("Acme Corp");
    expect(result.action?.kind).toBe("trim_whitespace");
  });

  it("returns a null action when a value needs no repair at all", () => {
    const result = repairField("company", "Acme Corp");
    expect(result.action).toBeNull();
    expect(result.value).toBe("Acme Corp");
  });
});
