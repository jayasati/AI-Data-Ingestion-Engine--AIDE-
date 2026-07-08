import { describe, expect, it } from "vitest";
import { WhitespaceRule } from "@/pipeline/stages/normalization/rules/whitespace-rule";

describe("WhitespaceRule", () => {
  const rule = new WhitespaceRule();

  it("always canApply", () => {
    expect(rule.canApply()).toBe(true);
  });

  it("matches the spec's own example: collapses repeated internal spaces and trims", () => {
    const result = rule.apply("   John     Doe  ");
    expect(result.value).toBe("John Doe");
    expect(result.changed).toBe(true);
  });

  it("collapses tabs to a single space", () => {
    const result = rule.apply("John\t\tDoe");
    expect(result.value).toBe("John Doe");
  });

  it("unifies CRLF and CR to LF", () => {
    const result = rule.apply("line1\r\nline2\rline3");
    expect(result.value).toBe("line1\nline2\nline3");
  });

  it("does not collapse intentional newlines in a multi-line cell", () => {
    const result = rule.apply("line1\nline2\nline3");
    expect(result.value).toBe("line1\nline2\nline3");
  });

  it("reports changed:false for already-clean text", () => {
    const result = rule.apply("Clean");
    expect(result.changed).toBe(false);
  });
});
