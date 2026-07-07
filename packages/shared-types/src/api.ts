/**
 * Canonical API envelope. Every AIDE endpoint — success or failure — returns
 * this exact shape so clients never branch on response structure.
 */
export interface ApiErrorPayload {
  /** Stable machine-readable code, e.g. "VALIDATION_ERROR". Never parse `message`. */
  code: string;
  message: string;
  /** Optional structured context (field errors, limits). Never includes stack traces. */
  details?: unknown;
}

export interface ApiMetadata {
  /** Milliseconds spent server-side handling this request. */
  durationMs?: number;
  [key: string]: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiErrorPayload | null;
  metadata: ApiMetadata;
  /** ISO-8601 UTC timestamp generated server-side. */
  timestamp: string;
  /** Correlation id; threads through logs and client error reports. */
  requestId: string;
}
