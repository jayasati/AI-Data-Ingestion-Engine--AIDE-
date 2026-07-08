import { describe, expect, it } from "vitest";
import { estimateCostUsd, estimateTokenCount } from "@/ai/orchestrator/token-estimator";

describe("estimateTokenCount", () => {
  it("matches the 4-chars-per-token formula", () => {
    expect(estimateTokenCount("a".repeat(40))).toBe(10);
    expect(estimateTokenCount("")).toBe(0);
  });

  it("rounds up for a partial token", () => {
    expect(estimateTokenCount("abc")).toBe(1);
    expect(estimateTokenCount("abcde")).toBe(2);
  });
});

describe("estimateCostUsd", () => {
  it("returns a positive number for a known model", () => {
    const cost = estimateCostUsd("gpt-4o-mini", {
      promptTokens: 1000,
      completionTokens: 1000,
      totalTokens: 2000,
    });
    expect(cost).not.toBeNull();
    expect(cost as number).toBeGreaterThan(0);
  });

  it("returns null for an unknown model (e.g. the Mock provider's model id)", () => {
    const cost = estimateCostUsd("mock-v1", {
      promptTokens: 100,
      completionTokens: 100,
      totalTokens: 200,
    });
    expect(cost).toBeNull();
  });

  it("computes the exact weighted sum for a known model", () => {
    const cost = estimateCostUsd("gpt-4o-mini", {
      promptTokens: 1000,
      completionTokens: 1000,
      totalTokens: 2000,
    });
    expect(cost).toBeCloseTo(0.00015 + 0.0006, 10);
  });
});
