import { describe, expect, it } from "vitest";
import type { NumberFieldDetails } from "@/pipeline/domain/normalization";
import { NumberRule } from "@/pipeline/stages/normalization/rules/number-rule";

const EURO = String.fromCharCode(0x20ac);
const POUND = String.fromCharCode(0x00a3);
const RUPEE = String.fromCharCode(0x20b9);

describe("NumberRule", () => {
  const rule = new NumberRule();

  it("canApply is true for numeric-shaped values", () => {
    expect(rule.canApply("1,200.50")).toBe(true);
  });

  it("canApply is false for non-numeric text", () => {
    expect(rule.canApply("hello")).toBe(false);
  });

  it("parses a dollar amount with thousands separators", () => {
    const result = rule.apply("$1,200.50");
    const details = result.details as NumberFieldDetails;
    expect(details.value).toBe(1200.5);
    expect(details.currencySymbol).toBe("$");
    expect(details.isPercentage).toBe(false);
    expect(result.confidence).toBe(1);
  });

  it("parses a plain integer with no symbol", () => {
    const result = rule.apply("890");
    const details = result.details as NumberFieldDetails;
    expect(details.value).toBe(890);
    expect(details.currencySymbol).toBeNull();
    expect(result.value).toBe("890");
  });

  it("parses a percentage", () => {
    const result = rule.apply("45%");
    const details = result.details as NumberFieldDetails;
    expect(details.value).toBe(45);
    expect(details.isPercentage).toBe(true);
  });

  it.each([
    [`${EURO}500`, EURO],
    [`${POUND}500`, POUND],
    [`${RUPEE}500`, RUPEE],
  ])("recognizes the %j currency symbol", (value, symbol) => {
    const details = rule.apply(value).details as NumberFieldDetails;
    expect(details.currencySymbol).toBe(symbol);
    expect(details.value).toBe(500);
  });

  it("flags an unparseable numeric-shaped value", () => {
    const result = rule.apply("$,.");
    const details = result.details as NumberFieldDetails;
    expect(details.value).toBeNull();
    expect(result.confidence).toBe(0.2);
    expect(result.warnings?.[0].code).toBe("UNPARSEABLE_NUMBER");
  });
});
