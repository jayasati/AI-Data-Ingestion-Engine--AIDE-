import { describe, expect, it } from "vitest";
import { computeHeaderConfidence } from "@/semantic/confidence/confidence-engine";
import { DEFAULT_SEMANTIC_CONFIG } from "@/semantic/config/semantic-config";
import type { ColumnSemanticProfile } from "@/semantic/column-intelligence/column-analyzer";
import type { HeaderSemanticProfile } from "@/semantic/header-intelligence/header-analyzer";
import type { RuleContext, SemanticRule } from "@/semantic/rules/rule-types";

const EMPTY_CLASSIFIER_RESULT = { matchRatio: 0, evidence: [] };

function header(overrides: Partial<HeaderSemanticProfile> = {}): HeaderSemanticProfile {
  return {
    columnIndex: 0,
    originalHeader: "Contact",
    normalizedHeader: "contact",
    candidates: [],
    isAmbiguous: false,
    ...overrides,
  };
}

function column(overrides: Partial<ColumnSemanticProfile> = {}): ColumnSemanticProfile {
  return {
    columnIndex: 0,
    header: "Contact",
    nonEmptyCount: 10,
    uniqueValueCount: 10,
    uniquenessRatio: 1,
    nullPercentage: 0,
    averageLength: 10,
    entropy: 1,
    likelyEmail: false,
    likelyPhone: false,
    likelyDate: false,
    likelyCurrency: false,
    likelyName: false,
    likelyCompany: false,
    likelyLocation: false,
    regexSignals: {},
    patternSignals: {},
    locationSignal: EMPTY_CLASSIFIER_RESULT,
    ...overrides,
  };
}

function stubRule(id: string, category: SemanticRule["category"], weight: number): SemanticRule {
  return {
    id,
    category,
    evaluate: () => [{ fieldId: "phone", weight, source: id, detail: id }],
  };
}

const UNIT_CONFIG = {
  ...DEFAULT_SEMANTIC_CONFIG,
  ruleWeights: { header: 1, knowledge: 1, regex: 1, pattern: 1, historical: 1 },
};

describe("computeHeaderConfidence", () => {
  it("combines two independent 0.5 signals via noisy-OR into 0.75", () => {
    const context: RuleContext = { header: header(), column: column() };
    const profile = computeHeaderConfidence(
      context,
      [stubRule("a", "regex", 0.5), stubRule("b", "pattern", 0.5)],
      UNIT_CONFIG,
    );
    expect(profile.candidates[0].confidence).toBeCloseTo(0.75);
  });

  it("never inflates a single weak signal via normalization", () => {
    const context: RuleContext = { header: header(), column: column() };
    const profile = computeHeaderConfidence(context, [stubRule("a", "regex", 0.2)], UNIT_CONFIG);
    expect(profile.candidates[0].confidence).toBeCloseTo(0.2);
  });

  it("applies a statistical rule as a signed adjustment on top of the base confidence", () => {
    const confirming: SemanticRule = {
      id: "stat",
      category: "statistical",
      evaluate: () => [{ fieldId: "phone", weight: 1, source: "stat", detail: "confirms" }],
    };
    const context: RuleContext = { header: header(), column: column() };
    const profile = computeHeaderConfidence(
      context,
      [stubRule("a", "regex", 0.5), confirming],
      UNIT_CONFIG,
    );
    expect(profile.candidates[0].confidence).toBeCloseTo(0.5 + UNIT_CONFIG.statisticalInfluence);
  });

  it("ignores a statistical signal for a field with no base hypothesis", () => {
    const inventing: SemanticRule = {
      id: "stat",
      category: "statistical",
      evaluate: () => [{ fieldId: "email", weight: 1, source: "stat", detail: "invents" }],
    };
    const context: RuleContext = { header: header(), column: column() };
    const profile = computeHeaderConfidence(
      context,
      [stubRule("a", "regex", 0.5), inventing],
      UNIT_CONFIG,
    );
    expect(profile.candidates.some((c) => c.fieldId === "email")).toBe(false);
  });

  it("drops candidates below minReportedConfidence and caps the candidate list", () => {
    const manyWeak: SemanticRule = {
      id: "weak",
      category: "regex",
      evaluate: () => [
        { fieldId: "email", weight: 0.01, source: "weak", detail: "" },
        { fieldId: "phone", weight: 0.9, source: "weak", detail: "" },
      ],
    };
    const context: RuleContext = { header: header(), column: column() };
    const profile = computeHeaderConfidence(context, [manyWeak], UNIT_CONFIG);
    expect(profile.candidates.some((c) => c.fieldId === "email")).toBe(false);
    expect(profile.candidates[0].fieldId).toBe("phone");
  });

  it("applies the rule category coefficient before combining", () => {
    const context: RuleContext = { header: header(), column: column() };
    const dampened = { ...UNIT_CONFIG, ruleWeights: { ...UNIT_CONFIG.ruleWeights, pattern: 0.5 } };
    const profile = computeHeaderConfidence(context, [stubRule("a", "pattern", 0.8)], dampened);
    expect(profile.candidates[0].confidence).toBeCloseTo(0.4);
  });

  it("returns no candidates when no rule produces a signal", () => {
    const context: RuleContext = { header: header(), column: column() };
    expect(computeHeaderConfidence(context, [], UNIT_CONFIG).candidates).toEqual([]);
  });
});
