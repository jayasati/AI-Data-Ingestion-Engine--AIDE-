import { describe, expect, it } from "vitest";
import { compilePrompt, type PromptCompilationInput } from "@/prompt/compiler/prompt-compiler";
import {
  benchmarkPromptVariants,
  comparePromptCompilations,
} from "@/prompt/benchmark/prompt-benchmark";
import type { DatasetContext } from "@/ai/context/dataset-context-builder";
import type {
  NormalizationReport,
  NormalizedField,
  NormalizedRecord,
} from "@/pipeline/domain/normalization";

const EMPTY_REPORT: NormalizationReport = {
  totalFields: 2,
  whitespaceNormalizedCount: 0,
  unicodeNormalizedCount: 0,
  nullValuesDetected: 0,
  emailsNormalized: 1,
  invalidEmails: 0,
  phonesNormalized: 0,
  invalidPhones: 0,
  datesParsed: 0,
  failedDateParses: 0,
  numbersNormalized: 0,
  booleansNormalized: 0,
  fieldsWithWarnings: 0,
  fieldsFailed: 0,
};

function field(header: string, value: string | null): NormalizedField {
  return {
    header,
    originalValue: value ?? "",
    normalizedValue: value,
    appliedRules: [],
    warnings: [],
    status: "unchanged",
    confidence: 1,
  };
}

const DATASET_CONTEXT: DatasetContext = {
  totalRecords: 1,
  headers: ["Full Name", "Email"],
  columns: [
    { header: "Full Name", detectedTypeHint: null, sampleValues: ["John Doe"], nullRatio: 0 },
    {
      header: "Email",
      detectedTypeHint: "email",
      sampleValues: ["john@example.com"],
      nullRatio: 0,
    },
  ],
};

const BATCH: readonly NormalizedRecord[] = [
  {
    rowNumber: 1,
    fields: [field("Full Name", "John Doe"), field("Email", "john@example.com")],
    warnings: [],
    hasErrors: false,
  },
];

function baseInput(): Omit<PromptCompilationInput, "config"> {
  return {
    datasetContext: DATASET_CONTEXT,
    normalizationReport: EMPTY_REPORT,
    batch: BATCH,
    supportsJsonMode: true,
    model: "mock-v1",
    maxContextTokens: 1_000_000,
  };
}

describe("benchmarkPromptVariants", () => {
  it("compiles every variant and reports per-variant metrics", () => {
    const report = benchmarkPromptVariants(baseInput(), [
      { label: "fewer-examples", config: { maxExamples: 1, maxNegativeExamples: 1 } },
      { label: "more-examples", config: { maxExamples: 2, maxNegativeExamples: 3 } },
    ]);

    expect(report.outcomes).toHaveLength(2);
    for (const outcome of report.outcomes) {
      expect(outcome.valid).toBe(true);
      expect(outcome.error).toBeNull();
      expect(outcome.estimatedPromptTokens).toBeGreaterThan(0);
      expect(outcome.compilationTimeMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("picks the lowest-token, warning-free variant as the winner", () => {
    const report = benchmarkPromptVariants(baseInput(), [
      { label: "more-examples", config: { maxExamples: 2, maxNegativeExamples: 3 } },
      { label: "fewer-examples", config: { maxExamples: 1, maxNegativeExamples: 1 } },
    ]);

    const fewer = report.outcomes.find((o) => o.label === "fewer-examples")!;
    const more = report.outcomes.find((o) => o.label === "more-examples")!;
    expect(fewer.estimatedPromptTokens!).toBeLessThan(more.estimatedPromptTokens!);
    expect(report.winner).toBe("fewer-examples");
  });

  it("captures a failed compilation without throwing and excludes it from winner selection", () => {
    const report = benchmarkPromptVariants(baseInput(), [
      { label: "oversized", config: { maxPromptSizeChars: 10 } },
      { label: "default" },
    ]);

    const oversized = report.outcomes.find((o) => o.label === "oversized")!;
    expect(oversized.valid).toBe(false);
    expect(oversized.error).toContain("failed validation");
    expect(oversized.warnings.some((w) => w.includes("exceeding"))).toBe(true);
    expect(report.winner).toBe("default");
  });

  it("returns a null winner when every variant fails compilation", () => {
    const report = benchmarkPromptVariants(baseInput(), [
      { label: "too-small-1", config: { maxPromptSizeChars: 1 } },
      { label: "too-small-2", config: { maxPromptSizeChars: 1 } },
    ]);

    expect(report.outcomes.every((o) => !o.valid)).toBe(true);
    expect(report.winner).toBeNull();
  });

  it("is deterministic across repeated runs with the same variants", () => {
    const variants = [
      { label: "a", config: { maxExamples: 1 } },
      { label: "b", config: { maxExamples: 2 } },
    ];
    const first = benchmarkPromptVariants(baseInput(), variants);
    const second = benchmarkPromptVariants(baseInput(), variants);
    expect(second.winner).toBe(first.winner);
    expect(second.outcomes.map((o) => o.estimatedPromptTokens)).toEqual(
      first.outcomes.map((o) => o.estimatedPromptTokens),
    );
  });
});

describe("comparePromptCompilations", () => {
  it("reports zero deltas when comparing a compilation against itself", () => {
    const compiled = compilePrompt(baseInput());
    const comparison = comparePromptCompilations(compiled, compiled);
    expect(comparison.tokenDeltaPct).toBe(0);
    expect(comparison.contextSizeDeltaChars).toBe(0);
    expect(comparison.warningCountDelta).toBe(0);
  });

  it("reports a positive token delta when the candidate compiles larger", () => {
    const baseline = compilePrompt({
      ...baseInput(),
      config: { maxExamples: 1, maxNegativeExamples: 1 },
    });
    const candidate = compilePrompt({
      ...baseInput(),
      config: { maxExamples: 2, maxNegativeExamples: 3 },
    });
    const comparison = comparePromptCompilations(baseline, candidate);
    expect(comparison.tokenDeltaPct).toBeGreaterThan(0);
    expect(comparison.contextSizeDeltaChars).toBeGreaterThan(0);
  });
});
