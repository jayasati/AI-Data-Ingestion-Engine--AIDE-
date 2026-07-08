import Anthropic from "@anthropic-ai/sdk";
import { classifyProviderError } from "@/ai/contracts/ai-error";
import type {
  AIRequest,
  AIResponse,
  LLMProvider,
  ProviderCapabilities,
} from "@/ai/contracts/llm-provider";

const CAPABILITIES: ProviderCapabilities = {
  // Claude has no dedicated JSON response mode -- the prompt compiler
  // instructs it more forcefully when this is false, see prompt-sections.ts.
  supportsJsonMode: false,
  maxContextTokens: 200_000,
  supportedModels: ["claude-sonnet-5", "claude-opus-4-8", "claude-haiku-4-5"],
};

export class ClaudeProvider implements LLMProvider {
  readonly id = "claude";
  readonly capabilities = CAPABILITIES;
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    const startedAt = Date.now();
    try {
      const systemMessage = request.messages.find((message) => message.role === "system")?.content;
      const userMessages = request.messages
        .filter((message) => message.role === "user")
        .map((message) => ({ role: "user" as const, content: message.content }));

      const response = await this.client.messages.create(
        {
          model: request.model,
          system: systemMessage,
          max_tokens: request.maxTokens,
          temperature: request.temperature,
          messages: userMessages,
        },
        { timeout: request.timeoutMs },
      );

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      return {
        text,
        model: response.model,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        finishReason: response.stop_reason,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      throw classifyProviderError("claude", error);
    }
  }
}
