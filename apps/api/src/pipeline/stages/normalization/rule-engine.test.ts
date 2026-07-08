import { describe, expect, it } from "vitest";
import type {
  BooleanFieldDetails,
  DateFieldDetails,
  EmailFieldDetails,
  NumberFieldDetails,
  PhoneFieldDetails,
} from "@/pipeline/domain/normalization";
import { FieldNormalizationEngine } from "@/pipeline/stages/normalization/rule-engine";
import { NullRule } from "@/pipeline/stages/normalization/rules/null-rule";
import type {
  NormalizationRule,
  NormalizationRuleOutcome,
} from "@/pipeline/stages/normalization/rules/normalization-rule";

const CONTEXT = { header: "Field", columnIndex: 0 };

describe("FieldNormalizationEngine", () => {
  const engine = new FieldNormalizationEngine();

  it("always applies Unicode and Whitespace first, regardless of content type", () => {
    const field = engine.normalizeValue("   John   Doe   ", CONTEXT);
    expect(field.normalizedValue).toBe("John Doe");
    expect(field.appliedRules).toContain("whitespace");
    expect(field.status).toBe("normalized");
  });

  it("takes the terminal Null path for a null-alias value, skipping content rules", () => {
    const field = engine.normalizeValue("N/A", CONTEXT);
    expect(field.normalizedValue).toBeNull();
    expect(field.appliedRules).toEqual(["null"]);
    expect(field.status).toBe("normalized");
    expect(field.confidence).toBe(1);
    expect(field.details).toBeUndefined();
  });

  it("routes an email-shaped value through EmailRule", () => {
    const field = engine.normalizeValue("JOHN@EXAMPLE.COM", CONTEXT);
    expect(field.normalizedValue).toBe("john@example.com");
    expect(field.appliedRules).toEqual(["email"]);
    const details = field.details as EmailFieldDetails;
    expect(details.kind).toBe("email");
  });

  it("routes a phone-shaped value through PhoneRule", () => {
    const field = engine.normalizeValue("+91 98765 43210", CONTEXT);
    const details = field.details as PhoneFieldDetails;
    expect(details.kind).toBe("phone");
    expect(details.e164).toBe("+919876543210");
  });

  it("routes a date-shaped value through DateRule", () => {
    const field = engine.normalizeValue("2026-01-15", CONTEXT);
    const details = field.details as DateFieldDetails;
    expect(details.kind).toBe("date");
    expect(details.iso).toBe("2026-01-15");
  });

  it("routes a numeric-shaped value through NumberRule", () => {
    const field = engine.normalizeValue("$1,200.50", CONTEXT);
    const details = field.details as NumberFieldDetails;
    expect(details.kind).toBe("number");
    expect(details.value).toBe(1200.5);
  });

  it("routes a word-boolean value through BooleanRule", () => {
    const field = engine.normalizeValue("Yes", CONTEXT);
    const details = field.details as BooleanFieldDetails;
    expect(details.kind).toBe("boolean");
    expect(details.value).toBe(true);
  });

  it("critical priority rule: a bare '1' resolves through NumberRule, not BooleanRule", () => {
    const field = engine.normalizeValue("1", CONTEXT);
    expect(field.details?.kind).toBe("number");
    expect((field.details as NumberFieldDetails).value).toBe(1);
  });

  it("critical priority rule: a bare '0' resolves through NumberRule, not BooleanRule", () => {
    const field = engine.normalizeValue("0", CONTEXT);
    expect(field.details?.kind).toBe("number");
    expect((field.details as NumberFieldDetails).value).toBe(0);
  });

  it("falls back to TextRule (plain text) when no content rule matches, status 'unchanged' if nothing changed", () => {
    const field = engine.normalizeValue("free text stays as-is", CONTEXT);
    expect(field.normalizedValue).toBe("free text stays as-is");
    expect(field.details).toBeUndefined();
    expect(field.status).toBe("unchanged");
  });

  it("falls back to TextRule and reports 'normalized' when only Text/Whitespace changed something", () => {
    const field = engine.normalizeValue("  free text  ", CONTEXT);
    expect(field.normalizedValue).toBe("free text");
    expect(field.status).toBe("normalized");
    expect(field.appliedRules).toContain("whitespace");
  });

  it("sets status 'warning' when the matched content rule itself carries a warning", () => {
    const field = engine.normalizeValue("05/06/2026", CONTEXT);
    expect(field.status).toBe("warning");
    expect(field.warnings).toHaveLength(1);
    expect(field.warnings[0].code).toBe("AMBIGUOUS_DATE");
  });

  it("uses context.header for the field's header", () => {
    const field = engine.normalizeValue("value", { header: "Custom Header", columnIndex: 3 });
    expect(field.header).toBe("Custom Header");
  });

  it("records appliedRules in execution order", () => {
    const field = engine.normalizeValue("  JOHN@EXAMPLE.COM  ", CONTEXT);
    expect(field.appliedRules).toEqual(["whitespace", "email"]);
  });

  it("catches a rule that throws and produces a 'failed' field, preserving the original value", () => {
    const throwingRule: NormalizationRule = {
      id: "throwing",
      canApply: () => true,
      apply: (): NormalizationRuleOutcome => {
        throw new Error("boom");
      },
    };
    const engineWithBrokenRule = new FieldNormalizationEngine({ contentRules: [throwingRule] });

    const field = engineWithBrokenRule.normalizeValue("anything", CONTEXT);
    expect(field.status).toBe("failed");
    expect(field.confidence).toBe(0);
    expect(field.originalValue).toBe("anything");
    expect(field.normalizedValue).toBe("anything");
    expect(field.warnings).toHaveLength(1);
    expect(field.warnings[0].code).toBe("NORMALIZATION_RULE_ERROR");
    expect(field.warnings[0].message).toContain("boom");
  });

  it("accepts a custom nullRule via the constructor option", () => {
    const customEngine = new FieldNormalizationEngine({
      nullRule: new NullRule(new Set(["missing"])),
    });
    const field = customEngine.normalizeValue("missing", CONTEXT);
    expect(field.normalizedValue).toBeNull();
    expect(field.appliedRules).toEqual(["null"]);
  });
});
