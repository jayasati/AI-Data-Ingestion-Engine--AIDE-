/** A single warning or diagnostic surfaced by the AI Orchestration Platform. */
export interface AIExtractIssueDTO {
  readonly code: string;
  readonly message: string;
}

export interface AITokenUsageDTO {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

export type AIExecutionStatusDTO = "success" | "parser_error" | "provider_error" | "timeout";

/**
 * Observability record for one AI call — provider, model, prompt/schema
 * version, timing, tokens, estimated cost, and diagnostics. Deliberately
 * never includes the compiled prompt or raw provider response text.
 */
export interface AIExecutionReportDTO {
  readonly requestId: string;
  readonly provider: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly schemaVersion: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly latencyMs: number;
  readonly tokenUsage: AITokenUsageDTO;
  /** null when the provider/model pricing isn't known (e.g. Mock). */
  readonly estimatedCostUsd: number | null;
  readonly status: AIExecutionStatusDTO;
  readonly warnings: readonly AIExtractIssueDTO[];
  readonly parserDiagnostics: readonly AIExtractIssueDTO[];
}

export interface ExtractedFieldDTO {
  readonly sourceHeader: string;
  readonly targetField: string;
  readonly value: string | null;
  readonly confidence: number;
}

export interface ExtractedRecordDTO {
  readonly rowNumber: number;
  readonly fields: readonly ExtractedFieldDTO[];
}

export interface AIExtractResponse {
  readonly implemented: true;
  readonly records: readonly ExtractedRecordDTO[];
  readonly recordCount: number;
  readonly report: AIExecutionReportDTO;
}
