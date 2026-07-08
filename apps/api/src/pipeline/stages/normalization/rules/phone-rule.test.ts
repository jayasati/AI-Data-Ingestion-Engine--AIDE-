import { describe, expect, it } from "vitest";
import type { PhoneFieldDetails } from "@/pipeline/domain/normalization";
import { PhoneRule } from "@/pipeline/stages/normalization/rules/phone-rule";

describe("PhoneRule", () => {
  const rule = new PhoneRule();

  it("canApply is true for a phone-shaped value", () => {
    expect(rule.canApply("+91 98765 43210")).toBe(true);
  });

  it("canApply is false for a value with too few digits", () => {
    expect(rule.canApply("12345")).toBe(false);
  });

  it("resolves a fully qualified international number to E.164 with country metadata", () => {
    const result = rule.apply("+91 98765 43210");
    expect(result.confidence).toBe(1);
    expect(result.warnings).toBeUndefined();
    const details = result.details as PhoneFieldDetails;
    expect(details.kind).toBe("phone");
    expect(details.e164).toBe("+919876543210");
    expect(details.countryCode).toBe("+91");
    expect(details.nationalNumber).toBe("9876543210");
    expect(result.value).toBe("+919876543210");
  });

  it("extracts digits without guessing a country when there is no leading +", () => {
    const result = rule.apply("555-123-4567");
    const details = result.details as PhoneFieldDetails;
    expect(details.e164).toBeNull();
    expect(details.countryCode).toBeNull();
    expect(details.nationalNumber).toBe("5551234567");
    expect(result.value).toBe("5551234567");
    expect(result.confidence).toBe(0.5);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings?.[0].code).toBe("PHONE_COUNTRY_UNKNOWN");
  });

  it("splits multiple phones on comma/semicolon/slash, carrying extras in additional", () => {
    const result = rule.apply("+91 98765 43210,+1 202 555 0143");
    const details = result.details as PhoneFieldDetails;
    expect(details.additional).toEqual(["+1 202 555 0143"]);
  });

  it("splits multiple phones on ' or '", () => {
    const result = rule.apply("+91 98765 43210 or +1 202 555 0143");
    const details = result.details as PhoneFieldDetails;
    expect(details.additional).toEqual(["+1 202 555 0143"]);
  });
});
