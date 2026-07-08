import { describe, expect, it } from "vitest";
import type { BooleanFieldDetails } from "@/pipeline/domain/normalization";
import { BooleanRule } from "@/pipeline/stages/normalization/rules/boolean-rule";

describe("BooleanRule", () => {
  const rule = new BooleanRule();

  it.each(["yes", "Y", "TRUE", "t", "YES"])("canApply is true for true-alias %j", (value) => {
    expect(rule.canApply(value)).toBe(true);
  });

  it.each(["no", "N", "FALSE", "f", "No"])("canApply is true for false-alias %j", (value) => {
    expect(rule.canApply(value)).toBe(true);
  });

  it("canApply is false for bare '0'/'1' -- those are NumberRule's territory in the engine", () => {
    expect(rule.canApply("0")).toBe(false);
    expect(rule.canApply("1")).toBe(false);
  });

  it("canApply is false for unrelated text", () => {
    expect(rule.canApply("maybe")).toBe(false);
  });

  it("maps true-aliases to boolean true", () => {
    const result = rule.apply("Yes");
    expect(result.value).toBe("true");
    const details = result.details as BooleanFieldDetails;
    expect(details.value).toBe(true);
    expect(result.confidence).toBe(1);
  });

  it("maps false-aliases to boolean false", () => {
    const result = rule.apply("No");
    expect(result.value).toBe("false");
    const details = result.details as BooleanFieldDetails;
    expect(details.value).toBe(false);
  });
});
