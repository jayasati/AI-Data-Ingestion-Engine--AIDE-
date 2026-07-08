import { describe, expect, it, vi } from "vitest";
import { AIOrchestrator } from "@/ai/orchestrator/ai-orchestrator";
import { AIProviderError } from "@/ai/contracts/ai-error";
import type {
  AIRequest,
  AIResponse,
  LLMProvider,
  ProviderCapabilities,
} from "@/ai/contracts/llm-provider";
import type { AIConfig } from "@/config/ai-config";
import type { Logger } from "@/core/logger";
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

const CONFIG: AIConfig = {
  defaultProvider: "mock",
  model: "fake-model",
  temperature: 0.2,
  maxTokens: 4096,
  timeoutMs: 45_000,
  retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
  promptVersion: "v1.0",
  outputSchemaVersion: "v1.0",
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
  const records: NormalizedRecord[] = [
    { rowNumber: 1, fields: [field("Full Name", "John Doe")], warnings: [], hasErrors: false },
    { rowNumber: 2, fields: [field("Full Name", "Jane Roe")], warnings: [], hasErrors: false },
  ];
  return { headers: ["Full Name"], records, recordCount: 2, report: EMPTY_REPORT };
}

const CAPABILITIES: ProviderCapabilities = {
  supportsJsonMode: true,
  maxContextTokens: 128_000,
  supportedModels: ["fake-model"],
};

function validResponseText(): string {
  return JSON.stringify({
    records: [
      { row: 1, fields: { name: { value: "John Doe", sourceHeader: "Full Name" } } },
      { row: 2, fields: { name: { value: "Jane Roe", sourceHeader: "Full Name" } } },
    ],
  });
}

function fakeProvider(
  complete: (request: AIRequest) => Promise<AIResponse>,
  capabilities = CAPABILITIES,
): LLMProvider {
  return { id: "fake", capabilities, complete };
}

function fakeResponse(text: string): AIResponse {
  return {
    text,
    model: "fake-model",
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    finishReason: "stop",
    latencyMs: 5,
  };
}

describe("AIOrchestrator", () => {
  it("happy path: resolves {extraction, report} with status success", async () => {
    const provider = fakeProvider(async () => fakeResponse(validResponseText()));
    const orchestrator = new AIOrchestrator(provider, CONFIG);

    const { extraction, report } = await orchestrator.run({ normalizedDataset: buildDataset() });

    expect(report.status).toBe("success");
    expect(report.provider).toBe("fake");
    expect(report.tokenUsage).toEqual({ promptTokens: 10, completionTokens: 20, totalTokens: 30 });
    expect(extraction.records).toHaveLength(2);
    expect(report.requestId).toBeTruthy();
    expect(report.warnings).toHaveLength(0);
  });

  it("provider throws: resolves (never rejects) with status provider_error and empty extraction", async () => {
    const provider = fakeProvider(async () => {
      throw new AIProviderError("fake", "AUTHENTICATION_FAILURE", "bad key");
    });
    const orchestrator = new AIOrchestrator(provider, CONFIG);

    const { extraction, report } = await orchestrator.run({ normalizedDataset: buildDataset() });

    expect(report.status).toBe("provider_error");
    expect(extraction.records).toHaveLength(0);
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0].code).toBe("AI_AUTHENTICATION_FAILURE");
  });

  it("provider throws a plain Error: still resolves with status provider_error", async () => {
    const provider = fakeProvider(async () => {
      throw new Error("network down");
    });
    const orchestrator = new AIOrchestrator(provider, CONFIG);

    const { report } = await orchestrator.run({ normalizedDataset: buildDataset() });
    expect(report.status).toBe("provider_error");
    expect(report.warnings[0].message).toBe("network down");
  });

  it("provider returns unparseable text: status parser_error with non-empty parserDiagnostics", async () => {
    const provider = fakeProvider(async () => fakeResponse("not json {"));
    const orchestrator = new AIOrchestrator(provider, CONFIG);

    const { extraction, report } = await orchestrator.run({ normalizedDataset: buildDataset() });

    expect(report.status).toBe("parser_error");
    expect(extraction.records).toHaveLength(0);
    expect(report.parserDiagnostics.length).toBeGreaterThan(0);
  });

  it("valid JSON with an invalid crm_status stays status success but carries the schema warning", async () => {
    const text = JSON.stringify({
      records: [{ row: 1, fields: { crm_status: { value: "New", sourceHeader: "Status" } } }],
    });
    const provider = fakeProvider(async () => fakeResponse(text));
    const orchestrator = new AIOrchestrator(provider, CONFIG);

    const { report } = await orchestrator.run({ normalizedDataset: buildDataset() });

    expect(report.status).toBe("success");
    expect(report.warnings.map((w) => w.code)).toContain("INVALID_CRM_STATUS");
  });

  it("compiles a different prompt depending on provider.capabilities.supportsJsonMode", async () => {
    let capturedWithJsonMode: AIRequest | null = null;
    let capturedWithoutJsonMode: AIRequest | null = null;

    const jsonModeProvider = fakeProvider(async (request) => {
      capturedWithJsonMode = request;
      return fakeResponse(validResponseText());
    });
    const noJsonModeProvider = fakeProvider(
      async (request) => {
        capturedWithoutJsonMode = request;
        return fakeResponse(validResponseText());
      },
      { ...CAPABILITIES, supportsJsonMode: false },
    );

    await new AIOrchestrator(jsonModeProvider, CONFIG).run({ normalizedDataset: buildDataset() });
    await new AIOrchestrator(noJsonModeProvider, CONFIG).run({ normalizedDataset: buildDataset() });

    expect(capturedWithJsonMode).not.toBeNull();
    expect(capturedWithoutJsonMode).not.toBeNull();
    const jsonModeMessages = capturedWithJsonMode!.messages.map((m) => m.content).join("\n");
    const noJsonModeMessages = capturedWithoutJsonMode!.messages.map((m) => m.content).join("\n");
    expect(jsonModeMessages).not.toBe(noJsonModeMessages);
    expect(noJsonModeMessages).toContain("no native JSON mode");
  });

  it("passes config model/temperature/maxTokens/timeoutMs through to the provider request", async () => {
    let captured: AIRequest | null = null;
    const provider = fakeProvider(async (request) => {
      captured = request;
      return fakeResponse(validResponseText());
    });
    const orchestrator = new AIOrchestrator(provider, CONFIG);
    await orchestrator.run({ normalizedDataset: buildDataset() });

    expect(captured).not.toBeNull();
    expect(captured!.model).toBe(CONFIG.model);
    expect(captured!.temperature).toBe(CONFIG.temperature);
    expect(captured!.maxTokens).toBe(CONFIG.maxTokens);
    expect(captured!.timeoutMs).toBe(CONFIG.timeoutMs);
  });

  it("enriches the compiled prompt with Semantic Intelligence hints when no datasetContext is supplied", async () => {
    let captured: AIRequest | null = null;
    const provider = fakeProvider(async (request) => {
      captured = request;
      return fakeResponse(validResponseText());
    });
    const dataset: NormalizedDataset = {
      headers: ["Zzyzx Qwerty"],
      records: [
        { rowNumber: 1, fields: [field("Zzyzx Qwerty", "xk92j")], warnings: [], hasErrors: false },
        { rowNumber: 2, fields: [field("Zzyzx Qwerty", "9f2a1")], warnings: [], hasErrors: false },
      ],
      recordCount: 2,
      report: EMPTY_REPORT,
    };

    const orchestrator = new AIOrchestrator(provider, CONFIG);
    await orchestrator.run({ normalizedDataset: dataset });

    const userMessage = captured!.messages.find((m) => m.role === "user")!.content;
    expect(userMessage).toContain("Detected dataset type");
    expect(userMessage).toContain('"Zzyzx Qwerty": no confident guess');
  });

  it("skips a header's semantic hint once it is confident enough to map deterministically", async () => {
    let captured: AIRequest | null = null;
    const provider = fakeProvider(async (request) => {
      captured = request;
      return fakeResponse(validResponseText());
    });
    const dataset: NormalizedDataset = {
      headers: ["Contact"],
      records: [
        { rowNumber: 1, fields: [field("Contact", "9876543210")], warnings: [], hasErrors: false },
        { rowNumber: 2, fields: [field("Contact", "9988776655")], warnings: [], hasErrors: false },
        { rowNumber: 3, fields: [field("Contact", "9123456780")], warnings: [], hasErrors: false },
      ],
      recordCount: 3,
      report: EMPTY_REPORT,
    };

    const orchestrator = new AIOrchestrator(provider, CONFIG);
    await orchestrator.run({ normalizedDataset: dataset });

    const userMessage = captured!.messages.find((m) => m.role === "user")!.content;
    expect(userMessage).toContain("Detected dataset type");
    expect(userMessage).not.toContain("Semantic field hints");
  });

  it("skips Semantic Intelligence analysis when the caller already supplied a datasetContext", async () => {
    let captured: AIRequest | null = null;
    const provider = fakeProvider(async (request) => {
      captured = request;
      return fakeResponse(validResponseText());
    });
    const orchestrator = new AIOrchestrator(provider, CONFIG);
    await orchestrator.run({
      normalizedDataset: buildDataset(),
      datasetContext: { totalRecords: 0, headers: [], columns: [] },
    });

    const userMessage = captured!.messages.find((m) => m.role === "user")!.content;
    expect(userMessage).not.toContain("Detected dataset type");
  });

  it("logs via the optional logger without throwing when none is provided", async () => {
    const provider = fakeProvider(async () => fakeResponse(validResponseText()));
    const logger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const orchestrator = new AIOrchestrator(provider, CONFIG, logger);
    await orchestrator.run({ normalizedDataset: buildDataset() });
    expect(logger.info).toHaveBeenCalled();
  });
});
