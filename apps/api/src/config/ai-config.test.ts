import { describe, expect, it } from "vitest";
import { ConfigurationError } from "@/core/errors";
import { loadAIConfig } from "@/config/ai-config";

describe("loadAIConfig", () => {
  it("defaults to the mock provider when AI_PROVIDER is unset, with no error", () => {
    const config = loadAIConfig({});
    expect(config.defaultProvider).toBe("mock");
    expect(config.model).toBe("mock-v1");
  });

  it("throws ConfigurationError when AI_PROVIDER=openai but OPENAI_API_KEY is missing", () => {
    expect(() => loadAIConfig({ AI_PROVIDER: "openai" })).toThrow(ConfigurationError);
  });

  it("throws ConfigurationError when AI_PROVIDER=gemini but GEMINI_API_KEY is missing", () => {
    expect(() => loadAIConfig({ AI_PROVIDER: "gemini" })).toThrow(ConfigurationError);
  });

  it("throws ConfigurationError when AI_PROVIDER=claude but CLAUDE_API_KEY is missing", () => {
    expect(() => loadAIConfig({ AI_PROVIDER: "claude" })).toThrow(ConfigurationError);
  });

  it("returns a populated config when AI_PROVIDER=openai and OPENAI_API_KEY is set", () => {
    const config = loadAIConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" });
    expect(config.defaultProvider).toBe("openai");
    expect(config.openaiApiKey).toBe("sk-test");
    expect(config.model).toBe("gpt-4o-mini");
  });

  it("throws ConfigurationError for an invalid AI_PROVIDER value", () => {
    expect(() => loadAIConfig({ AI_PROVIDER: "not-a-real-provider" })).toThrow(ConfigurationError);
  });

  it("respects an AI_MODEL override", () => {
    const config = loadAIConfig({
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-test",
      AI_MODEL: "gpt-4.1",
    });
    expect(config.model).toBe("gpt-4.1");
  });

  it("respects AI_TEMPERATURE/AI_MAX_TOKENS/AI_TIMEOUT_MS overrides", () => {
    const config = loadAIConfig({
      AI_TEMPERATURE: "0.7",
      AI_MAX_TOKENS: "2048",
      AI_TIMEOUT_MS: "10000",
    });
    expect(config.temperature).toBe(0.7);
    expect(config.maxTokens).toBe(2048);
    expect(config.timeoutMs).toBe(10000);
  });

  it("throws for an out-of-range AI_TEMPERATURE", () => {
    expect(() => loadAIConfig({ AI_TEMPERATURE: "5" })).toThrow(ConfigurationError);
  });

  it("throws for a non-numeric AI_MAX_TOKENS", () => {
    expect(() => loadAIConfig({ AI_MAX_TOKENS: "not-a-number" })).toThrow(ConfigurationError);
  });

  it("throws for a non-positive AI_TIMEOUT_MS", () => {
    expect(() => loadAIConfig({ AI_TIMEOUT_MS: "0" })).toThrow(ConfigurationError);
  });

  it("does not mutate or read process.env when an explicit env object is passed", () => {
    const config = loadAIConfig({ AI_PROVIDER: "mock" });
    expect(config.defaultProvider).toBe("mock");
  });
});
