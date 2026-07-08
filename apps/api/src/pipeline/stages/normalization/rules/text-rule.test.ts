import { describe, expect, it } from "vitest";
import { TextRule } from "@/pipeline/stages/normalization/rules/text-rule";

const LEFT_DOUBLE_QUOTE = String.fromCharCode(0x201c);
const RIGHT_DOUBLE_QUOTE = String.fromCharCode(0x201d);
const LEFT_SINGLE_QUOTE = String.fromCharCode(0x2018);
const RIGHT_SINGLE_QUOTE = String.fromCharCode(0x2019);

describe("TextRule", () => {
  const rule = new TextRule();

  it("always canApply", () => {
    expect(rule.canApply()).toBe(true);
  });

  it("replaces curly double quotes with straight quotes", () => {
    const result = rule.apply(`He said ${LEFT_DOUBLE_QUOTE}hi${RIGHT_DOUBLE_QUOTE}`);
    expect(result.value).toBe('He said "hi"');
    expect(result.changed).toBe(true);
  });

  it("replaces curly single quotes/apostrophes with straight quotes", () => {
    const result = rule.apply(
      `It${RIGHT_SINGLE_QUOTE}s ${LEFT_SINGLE_QUOTE}great${RIGHT_SINGLE_QUOTE}`,
    );
    expect(result.value).toBe("It's 'great'");
  });

  it("does not change capitalization -- preserves user intent in free text", () => {
    const result = rule.apply("free text STAYS as-is");
    expect(result.value).toBe("free text STAYS as-is");
    expect(result.changed).toBe(false);
  });

  it("reports changed:false for text with no curly quotes", () => {
    const result = rule.apply('already "straight"');
    expect(result.changed).toBe(false);
  });
});
