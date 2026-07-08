import { describe, expect, it } from "vitest";
import { buildPromptExecutionMetadata } from "@/prompt/observability/prompt-observability";

describe("buildPromptExecutionMetadata", () => {
  it("computes contextSizeChars as system + user message length", () => {
    const metadata = buildPromptExecutionMetadata({
      promptVersion: "v1.0",
      promptHash: "abc",
      templateId: "crm-extraction",
      examplesUsed: [],
      negativeExamplesUsed: [],
      systemMessage: "1234",
      userMessage: "12345",
      tokenEstimate: {
        promptTokens: 10,
        estimatedCompletionTokens: 5,
        totalEstimatedTokens: 15,
        estimatedCostUsd: null,
        maxContextTokens: 100_000,
        exceedsMaxContext: false,
      },
      compilationTimeMs: 3,
      validation: { valid: true, issues: [] },
    });
    expect(metadata.contextSizeChars).toBe(9);
    expect(metadata.estimatedPromptTokens).toBe(10);
    expect(metadata.compilationTimeMs).toBe(3);
  });
});
