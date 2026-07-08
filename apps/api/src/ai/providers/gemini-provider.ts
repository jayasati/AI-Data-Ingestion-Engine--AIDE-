import { GoogleGenAI } from "@google/genai";
import { classifyProviderError } from "@/ai/contracts/ai-error";
import type {
  AIRequest,
  AIResponse,
  LLMProvider,
  ProviderCapabilities,
} from "@/ai/contracts/llm-provider";

const CAPABILITIES: ProviderCapabilities = {
  supportsJsonMode: true,
  maxContextTokens: 1_000_000,
  supportedModels: ["gemini-2.5-flash", "gemini-2.5-pro"],
};

export class GeminiProvider implements LLMProvider {
  readonly id = "gemini";
  readonly capabilities = CAPABILITIES;
  private readonly client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    const startedAt = Date.now();
    try {
      const systemInstruction = request.messages.find(
        (message) => message.role === "system",
      )?.content;
      const contents = request.messages
        .filter((message) => message.role === "user")
        .map((message) => message.content)
        .join("\n\n");

      const response = await this.client.models.generateContent({
        model: request.model,
        contents,
        config: {
          systemInstruction,
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
          responseMimeType: "application/json",
        },
      });

      const usage = response.usageMetadata;
      const promptTokens = usage?.promptTokenCount ?? 0;
      const completionTokens = usage?.candidatesTokenCount ?? 0;

      return {
        text: response.text ?? "",
        model: request.model,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: usage?.totalTokenCount ?? promptTokens + completionTokens,
        },
        finishReason: response.candidates?.[0]?.finishReason ?? null,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      throw classifyProviderError("gemini", error);
    }
  }
}
