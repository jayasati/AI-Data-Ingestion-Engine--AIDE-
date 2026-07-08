/**
 * Provider-independent request/response shapes. Every adapter (OpenAI,
 * Gemini, Claude, Mock) speaks this contract and nothing else — the
 * orchestrator never sees a provider-specific type.
 */
export interface AIRequestMessage {
  readonly role: "system" | "user";
  readonly content: string;
}

export interface AIRequest {
  readonly messages: readonly AIRequestMessage[];
  readonly model: string;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly timeoutMs: number;
}

export interface AITokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

export interface AIResponse {
  readonly text: string;
  readonly model: string;
  readonly usage: AITokenUsage;
  readonly finishReason: string | null;
  readonly latencyMs: number;
}

/**
 * What a provider can and cannot do, so the orchestrator/prompt compiler can
 * adapt behavior (e.g. how forcefully to instruct "respond with only JSON")
 * without knowing which specific provider it's talking to.
 */
export interface ProviderCapabilities {
  readonly supportsJsonMode: boolean;
  readonly maxContextTokens: number;
  readonly supportedModels: readonly string[];
}

export interface ProviderConfiguration {
  readonly apiKey?: string;
  readonly model: string;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly timeoutMs: number;
}

export interface LLMProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  complete(request: AIRequest): Promise<AIResponse>;
}
