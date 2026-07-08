import { describe, expect, it } from "vitest";
import { estimatePromptTokens } from "@/prompt/tokens/token-estimator";

describe("estimatePromptTokens", () => {
  it("sums system + user message token estimates as promptTokens", () => {
    const estimate = estimatePromptTokens("a".repeat(400), "b".repeat(400), "mock-v1", 100_000);
    expect(estimate.promptTokens).toBe(200);
  });

  it("scales estimatedCompletionTokens by recordCount", () => {
    const estimate = estimatePromptTokens("", "", "mock-v1", 100_000, 5, 60);
    expect(estimate.estimatedCompletionTokens).toBe(300);
    expect(estimate.totalEstimatedTokens).toBe(300);
  });

  it("flags exceedsMaxContext when the total crosses maxContextTokens", () => {
    const withinLimit = estimatePromptTokens("x".repeat(400), "", "mock-v1", 1000);
    const overLimit = estimatePromptTokens("x".repeat(400), "", "mock-v1", 10);
    expect(withinLimit.exceedsMaxContext).toBe(false);
    expect(overLimit.exceedsMaxContext).toBe(true);
  });

  it("returns null estimatedCostUsd for a model with no known pricing (e.g. mock)", () => {
    expect(estimatePromptTokens("x", "y", "mock-v1", 100_000).estimatedCostUsd).toBeNull();
  });

  it("returns a non-null estimatedCostUsd for a priced model", () => {
    expect(
      estimatePromptTokens("x".repeat(400), "", "gpt-4o-mini", 100_000).estimatedCostUsd,
    ).not.toBeNull();
  });

  it("clamps a negative recordCount to zero completion tokens", () => {
    expect(estimatePromptTokens("", "", "mock-v1", 100_000, -5).estimatedCompletionTokens).toBe(0);
  });
});
