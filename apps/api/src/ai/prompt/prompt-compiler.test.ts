import { describe, expect, it } from "vitest";
import { compilePrompt } from "@/ai/prompt/prompt-compiler";
import { CRM_STATUS_VALUES } from "@/ai/schema/crm-output-schema";
import type { DatasetContext } from "@/ai/context/dataset-context-builder";
import type { NormalizedField, NormalizedRecord } from "@/pipeline/domain/normalization";

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

function field(header: string, normalizedValue: string | null): NormalizedField {
  return {
    header,
    originalValue: normalizedValue ?? "",
    normalizedValue,
    appliedRules: [],
    warnings: [],
    status: "unchanged",
    confidence: 1,
  };
}

const BATCH: readonly NormalizedRecord[] = [
  {
    rowNumber: 1,
    fields: [field("Full Name", "John Doe"), field("Email", "john@example.com")],
    warnings: [],
    hasErrors: false,
  },
];

describe("compilePrompt", () => {
  it("includes identity/mission/business-rules content in the system message", () => {
    const compiled = compilePrompt({
      datasetContext: DATASET_CONTEXT,
      batch: BATCH,
      supportsJsonMode: true,
    });
    expect(compiled.systemMessage).toContain("# Identity");
    expect(compiled.systemMessage).toContain("# Mission");
    expect(compiled.systemMessage).toContain("# Business Rules");
    for (const status of CRM_STATUS_VALUES) {
      expect(compiled.systemMessage).toContain(status);
    }
  });

  it("includes dataset context and the current batch JSON in the user message", () => {
    const compiled = compilePrompt({
      datasetContext: DATASET_CONTEXT,
      batch: BATCH,
      supportsJsonMode: true,
    });
    expect(compiled.userMessage).toContain("# Dataset Context");
    expect(compiled.userMessage).toContain("# Current Batch");
    expect(compiled.userMessage).toContain('"Full Name": "John Doe"');
    expect(compiled.userMessage).toContain("john@example.com");
  });

  it("produces a stricter output-schema section when supportsJsonMode is false", () => {
    const withJsonMode = compilePrompt({
      datasetContext: DATASET_CONTEXT,
      batch: BATCH,
      supportsJsonMode: true,
    });
    const withoutJsonMode = compilePrompt({
      datasetContext: DATASET_CONTEXT,
      batch: BATCH,
      supportsJsonMode: false,
    });

    expect(withoutJsonMode.userMessage).not.toBe(withJsonMode.userMessage);
    expect(withoutJsonMode.userMessage).toContain("no native JSON mode");
    expect(withJsonMode.userMessage).not.toContain("no native JSON mode");
  });

  it("selects a non-empty set of examples whose categories are known", () => {
    const compiled = compilePrompt({
      datasetContext: DATASET_CONTEXT,
      batch: BATCH,
      supportsJsonMode: true,
    });
    const knownCategories = [
      "facebook-leads",
      "google-ads",
      "crm-export",
      "real-estate",
      "excel",
      "marketing-agency",
      "manual-spreadsheet",
    ];
    expect(compiled.examplesUsed.length).toBeGreaterThan(0);
    for (const category of compiled.examplesUsed) {
      expect(knownCategories).toContain(category);
    }
  });

  it("respects a custom exampleLimit", () => {
    const compiled = compilePrompt({
      datasetContext: DATASET_CONTEXT,
      batch: BATCH,
      supportsJsonMode: true,
      exampleLimit: 1,
    });
    expect(compiled.examplesUsed.length).toBeLessThanOrEqual(1);
  });

  it("estimates tokens as roughly totalChars / 4", () => {
    const compiled = compilePrompt({
      datasetContext: DATASET_CONTEXT,
      batch: BATCH,
      supportsJsonMode: true,
    });
    const totalChars = compiled.systemMessage.length + compiled.userMessage.length;
    expect(compiled.estimatedTokens).toBe(Math.ceil(totalChars / 4));
    expect(compiled.estimatedTokens).toBeGreaterThan(0);
  });

  it("stamps the current PROMPT_VERSION on every compiled prompt", () => {
    const compiled = compilePrompt({
      datasetContext: DATASET_CONTEXT,
      batch: BATCH,
      supportsJsonMode: true,
    });
    expect(compiled.promptVersion).toBe("v1.0");
  });
});
