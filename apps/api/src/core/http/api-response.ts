import type { ApiErrorPayload, ApiMetadata, ApiResponse } from "@aide/shared-types";
import type { Request } from "express";

/** Every endpoint responds through these builders so the envelope can never drift. */
export function buildSuccess<T>(
  requestId: string,
  data: T,
  metadata: ApiMetadata = {},
): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    metadata,
    timestamp: new Date().toISOString(),
    requestId,
  };
}

export function buildFailure(
  requestId: string,
  error: ApiErrorPayload,
  metadata: ApiMetadata = {},
): ApiResponse<null> {
  return {
    success: false,
    data: null,
    error,
    metadata,
    timestamp: new Date().toISOString(),
    requestId,
  };
}

/** Standard per-request metadata derived from the request-id middleware's timestamp. */
export function requestMetadata(req: Request): ApiMetadata {
  return { durationMs: Date.now() - req.startedAt };
}
