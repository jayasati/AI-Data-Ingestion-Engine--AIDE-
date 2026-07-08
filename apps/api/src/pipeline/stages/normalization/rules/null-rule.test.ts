import { describe, expect, it } from "vitest";
import { NullRule } from "@/pipeline/stages/normalization/rules/null-rule";

describe("NullRule", () => {
  const rule = new NullRule();

  it.each([
    "",
    "N/A",
    "n/a",
    "NA",
    "na",
    "#N/A",
    "-",
    "--",
    "NULL",
    "null",
    "None",
    "Unknown",
    "nil",
    "undefined",
  ])("canApply is true for null-alias %j (default aliases)", (value) => {
    expect(rule.canApply(value)).toBe(true);
  });

  it("canApply is true regardless of surrounding whitespace", () => {
    expect(rule.canApply("  n/a  ")).toBe(true);
  });

  it("canApply is false for values that are not aliases", () => {
    expect(rule.canApply("John Doe")).toBe(false);
    expect(rule.canApply("0")).toBe(false);
  });

  it("apply always returns a terminal null outcome", () => {
    const result = rule.apply();
    expect(result).toEqual({ value: null, changed: true, terminal: true });
  });

  it("accepts a custom alias set via the constructor", () => {
    const customRule = new NullRule(new Set(["missing", "tbd"]));
    expect(customRule.canApply("missing")).toBe(true);
    expect(customRule.canApply("tbd")).toBe(true);
    // The default alias "n/a" is NOT recognized once a custom set replaces it.
    expect(customRule.canApply("n/a")).toBe(false);
  });
});
