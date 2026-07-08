import { describe, expect, it } from "vitest";
import { compilePrompt, PromptCompilationError } from "@/prompt/compiler/prompt-compiler";
import { PromptRegistry } from "@/prompt/registry/prompt-registry";
import { DEFAULT_PROMPT_REGISTRY, PROMPT_VERSION } from "@/prompt/registry/default-prompt-registry";
import { MockProvider } from "@/ai/providers/mock-provider";
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

function baseInput() {
  return {
    datasetContext: DATASET_CONTEXT,
    normalizationReport: EMPTY_REPORT,
    batch: BATCH,
    supportsJsonMode: true,
    model: "mock-v1",
    maxContextTokens: 1_000_000,
  };
}

describe("compilePrompt", () => {
  it("assembles all system sections and stamps the current PROMPT_VERSION", () => {
    const compiled = compilePrompt(baseInput());
    expect(compiled.systemMessage).toContain("# Identity");
    expect(compiled.systemMessage).toContain("# Mission");
    expect(compiled.systemMessage).toContain("# Business Rules");
    expect(compiled.promptVersion).toBe(PROMPT_VERSION);
  });

  it("assembles user-message sections with Current Batch last", () => {
    const compiled = compilePrompt(baseInput());
    expect(compiled.userMessage).toContain("# Dataset Context");
    expect(compiled.userMessage).toContain("# Output Schema");
    expect(compiled.userMessage).toContain("# Current Batch");
    const lastSectionIndex = compiled.userMessage.lastIndexOf("# ");
    expect(compiled.userMessage.slice(lastSectionIndex)).toContain("Current Batch");
  });

  it("reports which examples were used", () => {
    const compiled = compilePrompt(baseInput());
    expect(compiled.examplesUsed.length).toBeGreaterThan(0);
  });

  it("includes negative examples and reports which were used", () => {
    const compiled = compilePrompt(baseInput());
    expect(compiled.userMessage).toContain("# Known Wrong Mappings");
    expect(compiled.negativeExamplesUsed.length).toBeGreaterThan(0);
  });

  it("produces a real, non-zero token estimate, hash, and compilation time", () => {
    const compiled = compilePrompt(baseInput());
    expect(compiled.estimatedTokens).toBeGreaterThan(0);
    expect(compiled.promptHash).toMatch(/^[0-9a-f]{16}$/);
    expect(compiled.compilationTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("carries a valid validation result and matching observability metadata/report", () => {
    const compiled = compilePrompt(baseInput());
    expect(compiled.validation.valid).toBe(true);
    expect(compiled.metadata.promptHash).toBe(compiled.promptHash);
    expect(compiled.report.templateId).toBe("crm-extraction");
    expect(compiled.report.warnings).toEqual([]);
  });

  it("is byte-compatible with MockProvider end-to-end", async () => {
    const compiled = compilePrompt(baseInput());
    const provider = new MockProvider();
    const response = await provider.complete({
      messages: [
        { role: "system", content: compiled.systemMessage },
        { role: "user", content: compiled.userMessage },
      ],
      model: "mock-v1",
      temperature: 0,
      maxTokens: 1000,
      timeoutMs: 1000,
    });
    const parsed = JSON.parse(response.text) as { records: Array<{ row: number }> };
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0].row).toBe(1);
  });

  it("records usage against the prompt registry", () => {
    const registry = new PromptRegistry();
    registry.register({
      id: "crm-extraction",
      category: "crm-extraction",
      description: "x",
      versions: [
        {
          version: PROMPT_VERSION,
          author: "system",
          createdAt: "2026-07-08T00:00:00.000Z",
          releaseNotes: "x",
          contentHash: "0000000000000000",
        },
      ],
      currentVersion: PROMPT_VERSION,
    });
    compilePrompt({ ...baseInput(), promptRegistry: registry });
    expect(registry.usageFor("crm-extraction", PROMPT_VERSION)?.executionCount).toBe(1);
  });

  it("throws PromptCompilationError with structured issues when a hard validation error occurs", () => {
    expect(() => compilePrompt({ ...baseInput(), config: { maxPromptSizeChars: 10 } })).toThrow(
      PromptCompilationError,
    );

    try {
      compilePrompt({ ...baseInput(), config: { maxPromptSizeChars: 10 } });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PromptCompilationError);
      const validationError = error as PromptCompilationError;
      expect(validationError.validation.issues.map((i) => i.code)).toContain("OVERSIZED_PROMPT");
    }
  });

  it("defaults to the shared DEFAULT_PROMPT_REGISTRY when none is supplied", () => {
    const before =
      DEFAULT_PROMPT_REGISTRY.usageFor("crm-extraction", PROMPT_VERSION)?.executionCount ?? 0;
    compilePrompt(baseInput());
    const after =
      DEFAULT_PROMPT_REGISTRY.usageFor("crm-extraction", PROMPT_VERSION)?.executionCount ?? 0;
    expect(after).toBe(before + 1);
  });
});
