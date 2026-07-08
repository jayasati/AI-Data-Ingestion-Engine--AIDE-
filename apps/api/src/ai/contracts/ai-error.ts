import { ApplicationError } from "@/core/errors/application-error";

export type AIErrorReason =
  | "PROVIDER_TIMEOUT"
  | "INVALID_RESPONSE"
  | "EMPTY_RESPONSE"
  | "MALFORMED_JSON"
  | "AUTHENTICATION_FAILURE"
  | "QUOTA_ERROR"
  | "RATE_LIMIT"
  | "UNSUPPORTED_MODEL"
  | "UNKNOWN_PROVIDER_ERROR";

/** One structured error type for every provider failure mode named in this volume's spec. */
export class AIProviderError extends ApplicationError {
  readonly provider: string;
  readonly reason: AIErrorReason;

  constructor(provider: string, reason: AIErrorReason, message: string, details?: unknown) {
    super(message, `AI_${reason}`, 502, true, details);
    this.provider = provider;
    this.reason = reason;
  }
}

interface SdkLikeError {
  readonly status?: number;
  readonly message?: string;
}

function isSdkLikeError(error: unknown): error is SdkLikeError {
  return typeof error === "object" && error !== null;
}

/**
 * Maps errors from any of the three provider SDKs onto one structured error
 * type, without depending on any SDK-specific error class — OpenAI,
 * Anthropic, and Google GenAI all attach an HTTP-like `status` to thrown
 * errors, which is enough to classify the common cases. Best-effort: SDKs
 * evolve their own error shapes over time, so the fallback is always a safe,
 * generic AIProviderError rather than a crash.
 */
export function classifyProviderError(provider: string, error: unknown): AIProviderError {
  const message =
    error instanceof Error
      ? error.message
      : isSdkLikeError(error) && typeof error.message === "string"
        ? error.message
        : String(error);

  if (error instanceof Error && error.name === "AbortError") {
    return new AIProviderError(provider, "PROVIDER_TIMEOUT", `${provider} request timed out.`, {
      message,
    });
  }

  if (isSdkLikeError(error)) {
    const status = error.status;
    if (status === 401 || status === 403) {
      return new AIProviderError(
        provider,
        "AUTHENTICATION_FAILURE",
        `${provider} rejected the API key.`,
        { status, message },
      );
    }
    if (status === 429) {
      const looksLikeQuota = /quota/i.test(message);
      return new AIProviderError(
        provider,
        looksLikeQuota ? "QUOTA_ERROR" : "RATE_LIMIT",
        `${provider} ${looksLikeQuota ? "quota exceeded" : "rate limit hit"}.`,
        { status, message },
      );
    }
    if (status === 404) {
      return new AIProviderError(
        provider,
        "UNSUPPORTED_MODEL",
        `${provider} does not recognize the requested model.`,
        { status, message },
      );
    }
    if (status === 408 || status === 504) {
      return new AIProviderError(provider, "PROVIDER_TIMEOUT", `${provider} request timed out.`, {
        status,
        message,
      });
    }
  }

  return new AIProviderError(
    provider,
    "UNKNOWN_PROVIDER_ERROR",
    `${provider} request failed: ${message}`,
    { message },
  );
}
