import OpenAI from "openai";
import { classifyProviderError } from "@/ai/contracts/ai-error";
import type {
  AIRequest,
  AIResponse,
  LLMProvider,
  ProviderCapabilities,
} from "@/ai/contracts/llm-provider";

const CAPABILITIES: ProviderCapabilities = {
  supportsJsonMode: true,
  maxContextTokens: 128_000,
  supportedModels: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"],
};

export class OpenAIProvider implements LLMProvider {
  readonly id = "openai";
  readonly capabilities = CAPABILITIES;
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    const startedAt = Date.now();
    try {
      const response = await this.client.chat.completions.create(
        {
          model: request.model,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          response_format: { type: "json_object" },
        },
        { timeout: request.timeoutMs },
      );

      const choice = response.choices[0];
      return {
        text: choice?.message?.content ?? "",
        model: response.model,
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
        finishReason: choice?.finish_reason ?? null,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      throw classifyProviderError("openai", error);
    }
  }
}
