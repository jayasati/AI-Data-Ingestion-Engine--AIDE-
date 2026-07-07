import type { ApiResponse, HealthResponse } from "@aide/shared-types";
import { env } from "@/config/env";

/** Thrown for every failed API interaction so callers handle one error type. */
export class ApiClientError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly requestId?: string;

  constructor(
    code: string,
    message: string,
    options: { status?: number; requestId?: string; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "ApiClientError";
    this.code = code;
    this.status = options.status;
    this.requestId = options.requestId;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (cause) {
    throw new ApiClientError("NETWORK_ERROR", "Could not reach the AIDE API.", { cause });
  }

  let body: ApiResponse<T>;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(
      "INVALID_RESPONSE",
      `The API returned a non-JSON response (HTTP ${response.status}).`,
      { status: response.status },
    );
  }

  if (!response.ok || !body.success || body.data === null) {
    throw new ApiClientError(
      body.error?.code ?? "UNKNOWN_ERROR",
      body.error?.message ?? `Request failed (HTTP ${response.status}).`,
      { status: response.status, requestId: body.requestId },
    );
  }

  return body.data;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, payload?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: payload === undefined ? undefined : JSON.stringify(payload),
    }),
};

export function fetchApiHealth(): Promise<HealthResponse> {
  return apiClient.get<HealthResponse>("/health");
}
