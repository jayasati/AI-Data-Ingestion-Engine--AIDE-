import type { ApiResponse, ImportAccepted, ResultSummary } from "@aide/shared-types";
import { env } from "@/config/env";
import { apiClient, ApiClientError } from "@/services/api-client";

/**
 * Multipart upload, so this bypasses api-client's `request()` helper (which
 * always sets `Content-Type: application/json`) — the browser must set the
 * multipart boundary itself from the FormData body. Mirrors submitAIExtract.
 */
export async function submitImport(file: File): Promise<ImportAccepted> {
  const formData = new FormData();
  formData.append("file", file);

  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}/import`, { method: "POST", body: formData });
  } catch (cause) {
    throw new ApiClientError("NETWORK_ERROR", "Could not reach the AIDE API.", { cause });
  }

  let body: ApiResponse<ImportAccepted>;
  try {
    body = (await response.json()) as ApiResponse<ImportAccepted>;
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

/** Meant to be polled — the Execution Platform runs in the background; this reads whatever it's produced so far. */
export function fetchImportResult(importId: string): Promise<ResultSummary> {
  return apiClient.get<ResultSummary>(`/import/${importId}`);
}
