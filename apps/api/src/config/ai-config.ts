import { ConfigurationError } from "@/core/errors";

export type AIProviderId = "openai" | "gemini" | "claude" | "mock";

export interface AIRetryPolicy {
  /** Placeholder only — no retry engine exists yet ("architecture only" per this volume's scope). */
  readonly maxAttempts: number;
  readonly backoffMs: number;
}

export interface AIConfig {
  readonly defaultProvider: AIProviderId;
  readonly model: string;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly timeoutMs: number;
  readonly retryPolicy: AIRetryPolicy;
  readonly promptVersion: string;
  readonly outputSchemaVersion: string;
  readonly openaiApiKey?: string;
  readonly geminiApiKey?: string;
  readonly claudeApiKey?: string;
}

const AI_PROVIDERS = ["openai", "gemini", "claude", "mock"] as const;

const DEFAULT_MODEL_BY_PROVIDER: Readonly<Record<AIProviderId, string>> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-2.5-flash",
  claude: "claude-sonnet-5",
  mock: "mock-v1",
};

const DEFAULTS = {
  temperature: 0.2,
  maxTokens: 4096,
  timeoutMs: 45_000,
  retryPolicy: { maxAttempts: 1, backoffMs: 1000 } as AIRetryPolicy,
  promptVersion: "v1.0",
  outputSchemaVersion: "v1.0",
};

function readEnum<T extends string>(
  name: string,
  raw: string | undefined,
  allowed: readonly T[],
): T | undefined {
  if (raw === undefined || raw === "") {
    return undefined;
  }
  if ((allowed as readonly string[]).includes(raw)) {
    return raw as T;
  }
  throw new ConfigurationError(
    `${name} must be one of: ${allowed.join(", ")} (received "${raw}").`,
  );
}

function readFloat(
  name: string,
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new ConfigurationError(
      `${name} must be a number between ${min} and ${max} (received "${raw}").`,
    );
  }
  return parsed;
}

function readPositiveInt(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ConfigurationError(`${name} must be a positive integer (received "${raw}").`);
  }
  return parsed;
}

/**
 * Reads and validates AI provider configuration once at boot, mirroring
 * config/index.ts's fail-fast philosophy. If AI_PROVIDER is left unset, the
 * default is "mock" — a zero-config, zero-cost default so the app and its
 * tests never require a real API key to run. If AI_PROVIDER IS explicitly
 * set to a real provider but its API key is missing, that's a genuine
 * misconfiguration and this throws rather than silently falling back to
 * Mock (which would hide the problem in production).
 */
export function loadAIConfig(env: NodeJS.ProcessEnv = process.env): AIConfig {
  const requestedProvider = readEnum("AI_PROVIDER", env.AI_PROVIDER, AI_PROVIDERS);
  const defaultProvider: AIProviderId = requestedProvider ?? "mock";

  const openaiApiKey = env.OPENAI_API_KEY || undefined;
  const geminiApiKey = env.GEMINI_API_KEY || undefined;
  const claudeApiKey = env.CLAUDE_API_KEY || undefined;

  if (defaultProvider === "openai" && !openaiApiKey) {
    throw new ConfigurationError('AI_PROVIDER is "openai" but OPENAI_API_KEY is not set.');
  }
  if (defaultProvider === "gemini" && !geminiApiKey) {
    throw new ConfigurationError('AI_PROVIDER is "gemini" but GEMINI_API_KEY is not set.');
  }
  if (defaultProvider === "claude" && !claudeApiKey) {
    throw new ConfigurationError('AI_PROVIDER is "claude" but CLAUDE_API_KEY is not set.');
  }

  return {
    defaultProvider,
    model: env.AI_MODEL || DEFAULT_MODEL_BY_PROVIDER[defaultProvider],
    temperature: readFloat("AI_TEMPERATURE", env.AI_TEMPERATURE, DEFAULTS.temperature, 0, 2),
    maxTokens: readPositiveInt("AI_MAX_TOKENS", env.AI_MAX_TOKENS, DEFAULTS.maxTokens),
    timeoutMs: readPositiveInt("AI_TIMEOUT_MS", env.AI_TIMEOUT_MS, DEFAULTS.timeoutMs),
    retryPolicy: DEFAULTS.retryPolicy,
    promptVersion: DEFAULTS.promptVersion,
    outputSchemaVersion: DEFAULTS.outputSchemaVersion,
    openaiApiKey,
    geminiApiKey,
    claudeApiKey,
  };
}
