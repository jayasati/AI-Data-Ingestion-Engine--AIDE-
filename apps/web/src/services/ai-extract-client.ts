import type { AIExtractResponse, ApiResponse } from "@aide/shared-types";
import { env } from "@/config/env";
import { ApiClientError } from "@/services/api-client";

/**
 * Multipart upload, so this bypasses api-client's `request()` helper (which
 * always sets `Content-Type: application/json`) — the browser must set the
 * multipart boundary itself from the FormData body. Mirrors submitPreview.
 */
export async function submitAIExtract(file: File): Promise<AIExtractResponse> {
  const formData = new FormData();
  formData.append("file", file);

  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}/ai/extract`, { method: "POST", body: formData });
  } catch (cause) {
    throw new ApiClientError("NETWORK_ERROR", "Could not reach the AIDE API.", { cause });
  }

  let body: ApiResponse<AIExtractResponse>;
  try {
    body = (await response.json()) as ApiResponse<AIExtractResponse>;
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
