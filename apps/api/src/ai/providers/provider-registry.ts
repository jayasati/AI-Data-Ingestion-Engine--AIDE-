import { ConfigurationError } from "@/core/errors";
import type { AIConfig } from "@/config/ai-config";
import type { LLMProvider } from "@/ai/contracts/llm-provider";
import { ClaudeProvider } from "@/ai/providers/claude-provider";
import { GeminiProvider } from "@/ai/providers/gemini-provider";
import { MockProvider } from "@/ai/providers/mock-provider";
import { OpenAIProvider } from "@/ai/providers/openai-provider";

/**
 * The only place a concrete provider class is chosen. Switching providers
 * is a configuration change (AI_PROVIDER + the matching API key env var) —
 * nothing else in the orchestrator, prompt compiler, or pipeline stage ever
 * needs to change. `loadAIConfig` already fails fast if a real provider is
 * selected without its key; the checks here are a defensive backstop.
 */
export function createProvider(config: AIConfig): LLMProvider {
  switch (config.defaultProvider) {
    case "openai":
      if (!config.openaiApiKey) {
        throw new ConfigurationError('AI_PROVIDER is "openai" but OPENAI_API_KEY is not set.');
      }
      return new OpenAIProvider(config.openaiApiKey);
    case "gemini":
      if (!config.geminiApiKey) {
        throw new ConfigurationError('AI_PROVIDER is "gemini" but GEMINI_API_KEY is not set.');
      }
      return new GeminiProvider(config.geminiApiKey);
    case "claude":
      if (!config.claudeApiKey) {
        throw new ConfigurationError('AI_PROVIDER is "claude" but CLAUDE_API_KEY is not set.');
      }
      return new ClaudeProvider(config.claudeApiKey);
    case "mock":
      return new MockProvider();
    default: {
      const exhaustiveCheck: never = config.defaultProvider;
      throw new ConfigurationError(`Unknown AI provider: ${String(exhaustiveCheck)}`);
    }
  }
}
