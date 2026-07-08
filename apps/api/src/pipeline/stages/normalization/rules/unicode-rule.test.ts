import { describe, expect, it } from "vitest";
import { UnicodeRule } from "@/pipeline/stages/normalization/rules/unicode-rule";

const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
const BOM = String.fromCharCode(0xfeff);
const DECOMPOSED_E_ACUTE = "e" + String.fromCharCode(0x0301);
const COMPOSED_E_ACUTE = String.fromCharCode(0x00e9);
const CONTROL_CHAR = String.fromCharCode(0x0007); // bell, a C0 control char

describe("UnicodeRule", () => {
  const rule = new UnicodeRule();

  it("always canApply", () => {
    expect(rule.canApply()).toBe(true);
  });

  it("strips a leading BOM", () => {
    const result = rule.apply(`${BOM}Name`);
    expect(result.value).toBe("Name");
    expect(result.changed).toBe(true);
  });

  it("strips zero-width spaces", () => {
    const result = rule.apply(`Jos${ZERO_WIDTH_SPACE}e`);
    expect(result.value).toBe("Jose");
    expect(result.changed).toBe(true);
  });

  it("strips C0 control characters but preserves tab/newline", () => {
    const result = rule.apply(`a${CONTROL_CHAR}b\tc\nd`);
    expect(result.value).toBe("ab\tc\nd");
    expect(result.changed).toBe(true);
  });

  it("normalizes decomposed Unicode to composed (NFC) form", () => {
    const result = rule.apply(`Jos${DECOMPOSED_E_ACUTE}`);
    expect(result.value).toBe(`Jos${COMPOSED_E_ACUTE}`);
    expect(result.changed).toBe(true);
  });

  it("reports changed:false for already-clean text", () => {
    const result = rule.apply("Plain Text");
    expect(result.value).toBe("Plain Text");
    expect(result.changed).toBe(false);
  });
});
