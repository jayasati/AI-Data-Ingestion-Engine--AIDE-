import { describe, expect, it } from "vitest";
import { headerRule } from "@/semantic/rules/header-rule";
import { knowledgeRule } from "@/semantic/rules/knowledge-rule";
import { regexRule } from "@/semantic/rules/regex-rule";
import { patternRule } from "@/semantic/rules/pattern-rule";
import { statisticalRule } from "@/semantic/rules/statistical-rule";
import { historicalRule } from "@/semantic/rules/historical-rule";
import type { ColumnSemanticProfile } from "@/semantic/column-intelligence/column-analyzer";
import type { HeaderSemanticProfile } from "@/semantic/header-intelligence/header-analyzer";
import type { RuleContext } from "@/semantic/rules/rule-types";

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

function context(overrides: Partial<RuleContext> = {}): RuleContext {
  return { header: header(), column: column(), ...overrides };
}

describe("headerRule", () => {
  it("only emits signals for fuzzy candidates", () => {
    const ctx = context({
      header: header({
        candidates: [
          { fieldId: "phone", score: 0.6, matchType: "fuzzy" },
          { fieldId: "email", score: 1, matchType: "exact_alias" },
        ],
      }),
    });
    const signals = headerRule.evaluate(ctx);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ fieldId: "phone", weight: 0.6 });
  });
});

describe("knowledgeRule", () => {
  it("only emits signals for exact_alias candidates", () => {
    const ctx = context({
      header: header({
        candidates: [
          { fieldId: "phone", score: 0.6, matchType: "fuzzy" },
          { fieldId: "email", score: 1, matchType: "exact_alias" },
        ],
      }),
    });
    const signals = knowledgeRule.evaluate(ctx);
    expect(signals).toEqual([
      { fieldId: "email", weight: 1, source: "knowledge-base", detail: expect.any(String) },
    ]);
  });
});

describe("regexRule", () => {
  it("emits one signal per non-zero regex classifier result", () => {
    const ctx = context({
      column: column({ regexSignals: { phone: { matchRatio: 0.9, evidence: ["9876543210"] } } }),
    });
    const signals = regexRule.evaluate(ctx);
    expect(signals).toEqual([
      { fieldId: "phone", weight: 0.9, source: "regex-matches", detail: expect.any(String) },
    ]);
  });

  it("emits nothing when there are no regex signals", () => {
    expect(regexRule.evaluate(context())).toEqual([]);
  });
});

describe("patternRule", () => {
  it("emits one signal per non-zero pattern classifier result", () => {
    const ctx = context({
      column: column({ patternSignals: { name: { matchRatio: 0.8, evidence: ["John Doe"] } } }),
    });
    const signals = patternRule.evaluate(ctx);
    expect(signals.some((s) => s.fieldId === "name" && s.weight === 0.8)).toBe(true);
  });

  it("reinforces city/state/country only when the header already hypothesized one of them", () => {
    const withHint = context({
      header: header({ candidates: [{ fieldId: "city", score: 1, matchType: "exact_alias" }] }),
      column: column({ locationSignal: { matchRatio: 0.7, evidence: ["Bengaluru"] } }),
    });
    expect(patternRule.evaluate(withHint)).toContainEqual(
      expect.objectContaining({ fieldId: "city", weight: 0.7 }),
    );

    const withoutHint = context({
      column: column({ locationSignal: { matchRatio: 0.7, evidence: ["Bengaluru"] } }),
    });
    expect(patternRule.evaluate(withoutHint)).toEqual([]);
  });
});

describe("statisticalRule", () => {
  it("confirms a high-uniqueness expectation with a positive adjustment", () => {
    const ctx = context({
      header: header({ candidates: [{ fieldId: "email", score: 1, matchType: "exact_alias" }] }),
      column: column({ uniquenessRatio: 0.95 }),
    });
    expect(statisticalRule.evaluate(ctx)).toEqual([
      { fieldId: "email", weight: 1, source: "column-statistics", detail: expect.any(String) },
    ]);
  });

  it("refutes a high-uniqueness expectation with a negative adjustment", () => {
    const ctx = context({
      header: header({ candidates: [{ fieldId: "email", score: 1, matchType: "exact_alias" }] }),
      column: column({ uniquenessRatio: 0.1 }),
    });
    expect(statisticalRule.evaluate(ctx)).toEqual([
      { fieldId: "email", weight: -1, source: "column-statistics", detail: expect.any(String) },
    ]);
  });

  it("stays silent on fields with no cardinality expectation (e.g. company)", () => {
    const ctx = context({
      header: header({ candidates: [{ fieldId: "company", score: 1, matchType: "exact_alias" }] }),
    });
    expect(statisticalRule.evaluate(ctx)).toEqual([]);
  });

  it("stays silent when the sample is too small to trust", () => {
    const ctx = context({
      header: header({ candidates: [{ fieldId: "email", score: 1, matchType: "exact_alias" }] }),
      column: column({ nonEmptyCount: 1, uniquenessRatio: 1 }),
    });
    expect(statisticalRule.evaluate(ctx)).toEqual([]);
  });
});

describe("historicalRule", () => {
  it("always returns no signals (placeholder)", () => {
    expect(historicalRule.evaluate(context())).toEqual([]);
  });
});
