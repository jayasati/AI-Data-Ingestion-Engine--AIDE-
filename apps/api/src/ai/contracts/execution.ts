import type { StageIssue } from "@/pipeline/contracts/stage-result";
import type { AITokenUsage } from "@/ai/contracts/llm-provider";

/**
 * "success": a usable extraction was produced (with or without warnings).
 * "parser_error": the provider responded, but its text couldn't be turned
 *   into structured data — see ParserDiagnostic for detail.
 * "provider_error": the provider call itself failed (auth, quota, etc).
 * "timeout": the provider call exceeded the configured timeout.
 */
export type AIExecutionStatus = "success" | "parser_error" | "provider_error" | "timeout";

export interface ParserDiagnostic {
  readonly code: string;
  readonly message: string;
}

/**
 * Everything an operator or a future observability layer needs about one AI
 * call — provider, model, prompt/schema version, timing, tokens, estimated
 * cost, and diagnostics. Never includes the actual prompt or response text.
 */
export interface AIExecutionReport {
  readonly requestId: string;
  readonly provider: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly schemaVersion: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly latencyMs: number;
  readonly tokenUsage: AITokenUsage;
  /** null when the provider/model pricing isn't known (e.g. Mock). */
  readonly estimatedCostUsd: number | null;
  readonly status: AIExecutionStatus;
  readonly warnings: readonly StageIssue[];
  readonly parserDiagnostics: readonly ParserDiagnostic[];
}
