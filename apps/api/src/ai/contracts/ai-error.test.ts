import { describe, expect, it } from "vitest";
import { classifyProviderError } from "@/ai/contracts/ai-error";

/**
 * Real SDK errors (OpenAI/Anthropic/Google GenAI) are thrown as `Error`
 * subclasses with an HTTP-like `status` attached, not plain objects — tests
 * construct that same shape to exercise the realistic message-inspection
 * path (e.g. the quota-vs-rate-limit check for status 429). A separate test
 * below confirms the same message-based check also works for a plain,
 * non-Error SDK-like object.
 */
function sdkError(status: number, message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

describe("classifyProviderError", () => {
  it("classifies an AbortError as PROVIDER_TIMEOUT", () => {
    const error = new Error("aborted");
    error.name = "AbortError";
    const result = classifyProviderError("openai", error);
    expect(result.reason).toBe("PROVIDER_TIMEOUT");
    expect(result.provider).toBe("openai");
    expect(result.code).toBe("AI_PROVIDER_TIMEOUT");
  });

  it("classifies status 401 as AUTHENTICATION_FAILURE", () => {
    const result = classifyProviderError("openai", sdkError(401, "unauthorized"));
    expect(result.reason).toBe("AUTHENTICATION_FAILURE");
    expect(result.code).toBe("AI_AUTHENTICATION_FAILURE");
  });

  it("classifies status 403 as AUTHENTICATION_FAILURE", () => {
    const result = classifyProviderError("claude", sdkError(403, "forbidden"));
    expect(result.reason).toBe("AUTHENTICATION_FAILURE");
  });

  it("classifies status 429 with 'quota' in the message as QUOTA_ERROR", () => {
    const result = classifyProviderError("openai", sdkError(429, "You exceeded your quota"));
    expect(result.reason).toBe("QUOTA_ERROR");
    expect(result.code).toBe("AI_QUOTA_ERROR");
  });

  it("classifies status 429 without 'quota' in the message as RATE_LIMIT", () => {
    const result = classifyProviderError("openai", sdkError(429, "Too many requests"));
    expect(result.reason).toBe("RATE_LIMIT");
    expect(result.code).toBe("AI_RATE_LIMIT");
  });

  it("classifies status 404 as UNSUPPORTED_MODEL", () => {
    const result = classifyProviderError("gemini", sdkError(404, "model not found"));
    expect(result.reason).toBe("UNSUPPORTED_MODEL");
  });

  it("classifies status 408 as PROVIDER_TIMEOUT", () => {
    const result = classifyProviderError("openai", sdkError(408, "request timeout"));
    expect(result.reason).toBe("PROVIDER_TIMEOUT");
  });

  it("classifies status 504 as PROVIDER_TIMEOUT", () => {
    const result = classifyProviderError("openai", sdkError(504, "gateway timeout"));
    expect(result.reason).toBe("PROVIDER_TIMEOUT");
  });

  it("falls back to UNKNOWN_PROVIDER_ERROR for an unrecognized error shape", () => {
    const result = classifyProviderError("openai", "just a string error");
    expect(result.reason).toBe("UNKNOWN_PROVIDER_ERROR");
    expect(result.code).toBe("AI_UNKNOWN_PROVIDER_ERROR");
  });

  it("falls back to UNKNOWN_PROVIDER_ERROR for an object with no recognized status", () => {
    const result = classifyProviderError("openai", sdkError(500, "internal error"));
    expect(result.reason).toBe("UNKNOWN_PROVIDER_ERROR");
  });

  it("still classifies by status for a plain (non-Error) SDK-like object", () => {
    const result = classifyProviderError("openai", { status: 401, message: "unauthorized" });
    expect(result.reason).toBe("AUTHENTICATION_FAILURE");
  });

  it("reads the message off a plain (non-Error) SDK-like object for the quota/rate-limit split", () => {
    const result = classifyProviderError("openai", {
      status: 429,
      message: "You exceeded your quota",
    });
    expect(result.reason).toBe("QUOTA_ERROR");
  });

  it("AIProviderError is an instance of Error and carries an httpStatus of 502", () => {
    const result = classifyProviderError("openai", sdkError(401, "unauthorized"));
    expect(result).toBeInstanceOf(Error);
    expect(result.httpStatus).toBe(502);
    expect(result.isOperational).toBe(true);
  });
});
