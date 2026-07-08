import { describe, expect, it } from "vitest";
import { MockProvider } from "@/ai/providers/mock-provider";
import { compilePrompt } from "@/ai/prompt/prompt-compiler";
import { buildDatasetContext } from "@/ai/context/dataset-context-builder";
import { parseAIResponse } from "@/ai/response/response-parser";
import { validateAndMapExtraction } from "@/ai/response/extraction-mapper";
import type {
  NormalizationReport,
  NormalizedDataset,
  NormalizedField,
  NormalizedRecord,
} from "@/pipeline/domain/normalization";

const EMPTY_REPORT: NormalizationReport = {
  totalFields: 0,
  whitespaceNormalizedCount: 0,
  unicodeNormalizedCount: 0,
  nullValuesDetected: 0,
  emailsNormalized: 0,
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

function buildDataset(): NormalizedDataset {
  const headers = ["Full Name", "Email"];
  const records: NormalizedRecord[] = [
    {
      rowNumber: 1,
      fields: [field("Full Name", "John Doe"), field("Email", "john@example.com")],
      warnings: [],
      hasErrors: false,
    },
  ];
  return { headers, records, recordCount: 1, report: EMPTY_REPORT };
}

describe("MockProvider", () => {
  it("advertises supportsJsonMode true", () => {
    const provider = new MockProvider();
    expect(provider.capabilities.supportsJsonMode).toBe(true);
    expect(provider.id).toBe("mock");
  });

  it("resolves quickly and returns text that the real parser + mapper can consume end-to-end", async () => {
    const provider = new MockProvider();
    const dataset = buildDataset();
    const datasetContext = buildDatasetContext(dataset);
    const compiled = compilePrompt({
      datasetContext,
      batch: dataset.records,
      supportsJsonMode: true,
    });

    const startedAt = Date.now();
    const response = await provider.complete({
      messages: [
        { role: "system", content: compiled.systemMessage },
        { role: "user", content: compiled.userMessage },
      ],
      model: "mock-v1",
      temperature: 0.2,
      maxTokens: 4096,
      timeoutMs: 45_000,
    });
    expect(Date.now() - startedAt).toBeLessThan(2000);

    const parsed = parseAIResponse(response.text);
    expect(parsed.success).toBe(true);

    const validation = validateAndMapExtraction(parsed.data);
    expect(validation.extraction.records).toHaveLength(1);

    const nameField = validation.extraction.records[0].fields.find((f) => f.targetField === "name");
    const emailField = validation.extraction.records[0].fields.find(
      (f) => f.targetField === "email",
    );
    expect(nameField?.value).toBe("John Doe");
    expect(emailField?.value).toBe("john@example.com");
  });

  it("returns non-zero token usage derived from the request/response text", async () => {
    const provider = new MockProvider();
    const dataset = buildDataset();
    const datasetContext = buildDatasetContext(dataset);
    const compiled = compilePrompt({
      datasetContext,
      batch: dataset.records,
      supportsJsonMode: true,
    });

    const response = await provider.complete({
      messages: [
        { role: "system", content: compiled.systemMessage },
        { role: "user", content: compiled.userMessage },
      ],
      model: "mock-v1",
      temperature: 0.2,
      maxTokens: 4096,
      timeoutMs: 45_000,
    });

    expect(response.usage.promptTokens).toBeGreaterThan(0);
    expect(response.usage.completionTokens).toBeGreaterThan(0);
    expect(response.usage.totalTokens).toBe(
      response.usage.promptTokens + response.usage.completionTokens,
    );
    expect(response.finishReason).toBe("stop");
  });

  it("returns an empty records array when the batch marker/JSON cannot be found", async () => {
    const provider = new MockProvider();
    const response = await provider.complete({
      messages: [{ role: "user", content: "no batch section here" }],
      model: "mock-v1",
      temperature: 0.2,
      maxTokens: 4096,
      timeoutMs: 45_000,
    });
    const parsed = parseAIResponse(response.text);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ records: [] });
  });
});
