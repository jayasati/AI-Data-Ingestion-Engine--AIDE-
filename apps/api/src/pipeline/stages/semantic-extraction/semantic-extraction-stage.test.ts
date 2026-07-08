import { describe, expect, it } from "vitest";
import { AIOrchestrator } from "@/ai/orchestrator/ai-orchestrator";
import { readAIExecutionReport } from "@/ai/shared-state";
import type {
  AIRequest,
  AIResponse,
  LLMProvider,
  ProviderCapabilities,
} from "@/ai/contracts/llm-provider";
import type { AIConfig } from "@/config/ai-config";
import { DEFAULT_PIPELINE_CONFIGURATION, PipelineContext } from "@/pipeline/context";
import { SemanticExtractionStage } from "@/pipeline/stages/semantic-extraction/semantic-extraction-stage";
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

const CAPABILITIES: ProviderCapabilities = {
  supportsJsonMode: true,
  maxContextTokens: 128_000,
  supportedModels: ["fake-model"],
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
  ];
  return { headers: ["Full Name"], records, recordCount: 1, report: EMPTY_REPORT };
}

function fakeProvider(complete: (request: AIRequest) => Promise<AIResponse>): LLMProvider {
  return { id: "fake", capabilities: CAPABILITIES, complete };
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

function buildContext(): PipelineContext {
  return PipelineContext.create("test-import", DEFAULT_PIPELINE_CONFIGURATION);
}

describe("SemanticExtractionStage", () => {
  it("succeeds and carries the extraction result on a clean AI response", async () => {
    const text = JSON.stringify({
      records: [{ row: 1, fields: { name: { value: "John Doe", sourceHeader: "Full Name" } } }],
    });
    const orchestrator = new AIOrchestrator(
      fakeProvider(async () => fakeResponse(text)),
      CONFIG,
    );
    const stage = new SemanticExtractionStage(orchestrator);

    const execution = await stage.execute(buildDataset(), buildContext());

    expect(execution.result.outcome).toBe("success");
    if (execution.result.outcome === "success" || execution.result.outcome === "warning") {
      expect(execution.result.output.records).toHaveLength(1);
    }
  });

  it("reports outcome 'warning' when the AI report carries schema-validation warnings", async () => {
    const text = JSON.stringify({
      records: [{ row: 1, fields: { crm_status: { value: "New", sourceHeader: "Status" } } }],
    });
    const orchestrator = new AIOrchestrator(
      fakeProvider(async () => fakeResponse(text)),
      CONFIG,
    );
    const stage = new SemanticExtractionStage(orchestrator);

    const execution = await stage.execute(buildDataset(), buildContext());
    expect(execution.result.outcome).toBe("warning");
  });

  it("stores the AI execution report in sharedState, readable via readAIExecutionReport", async () => {
    const text = JSON.stringify({ records: [{ row: 1, fields: {} }] });
    const orchestrator = new AIOrchestrator(
      fakeProvider(async () => fakeResponse(text)),
      CONFIG,
    );
    const stage = new SemanticExtractionStage(orchestrator);

    const execution = await stage.execute(buildDataset(), buildContext());
    const report = readAIExecutionReport(execution.context);

    expect(report).toBeDefined();
    expect(report?.status).toBe("success");
    expect(report?.provider).toBe("fake");
  });

  it("merges aiRecordsExtracted/aiTotalTokens/aiLatencyMs into context.statistics", async () => {
    const text = JSON.stringify({ records: [{ row: 1, fields: {} }] });
    const orchestrator = new AIOrchestrator(
      fakeProvider(async () => fakeResponse(text)),
      CONFIG,
    );
    const stage = new SemanticExtractionStage(orchestrator);

    const execution = await stage.execute(buildDataset(), buildContext());

    expect(execution.context.statistics.aiRecordsExtracted).toBe(1);
    expect(execution.context.statistics.aiTotalTokens).toBe(30);
    expect(typeof execution.context.statistics.aiLatencyMs).toBe("number");
  });

  it("reports fatal_failure with null output when the orchestrator reports provider_error", async () => {
    const orchestrator = new AIOrchestrator(
      fakeProvider(async () => {
        throw new Error("boom");
      }),
      CONFIG,
    );
    const stage = new SemanticExtractionStage(orchestrator);

    const execution = await stage.execute(buildDataset(), buildContext());

    expect(execution.result.outcome).toBe("fatal_failure");
    expect(execution.result.output).toBeNull();
  });

  it("reports fatal_failure when the orchestrator reports parser_error", async () => {
    const orchestrator = new AIOrchestrator(
      fakeProvider(async () => fakeResponse("not json")),
      CONFIG,
    );
    const stage = new SemanticExtractionStage(orchestrator);

    const execution = await stage.execute(buildDataset(), buildContext());

    expect(execution.result.outcome).toBe("fatal_failure");
    expect(execution.result.output).toBeNull();
    expect(execution.result.info.errors.length).toBeGreaterThan(0);
  });
});
