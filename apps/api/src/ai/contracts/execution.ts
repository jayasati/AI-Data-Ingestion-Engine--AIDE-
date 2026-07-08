import type { StageIssue } from "@/pipeline/contracts/stage-result";
import type { AITokenUsage } from "@/ai/contracts/llm-provider";
import type { PromptExecutionMetadata } from "@/prompt";

/**
 * "success": a usable extraction was produced (with or without warnings).
 * "parser_error": the provider responded, but its text couldn't be turned
 *   into structured data — see ParserDiagnostic for detail.
 * "provider_error": the provider call itself failed (auth, quota, etc).
 * "timeout": the provider call exceeded the configured timeout.
 * "compilation_error": the Prompt Engineering Platform itself failed to
 *   produce a valid prompt (see `PromptCompilationError`) — the provider was
 *   never called.
 */
export type AIExecutionStatus =
  "success" | "parser_error" | "provider_error" | "timeout" | "compilation_error";

export interface ParserDiagnostic {
  readonly code: string;
  readonly message: string;
}

/**
 * Whether the Trust Layer's JSON Repair Engine (`@/trust/parser/json-repair`)
 * had to intervene before the response could be parsed. `attempted: false`
 * means the first `parseAIResponse` call already succeeded — the common
 * case. A repaired response still produces `status: "success"`; the Trust
 * Layer's Confidence Engine is what factors `succeeded` into a record's
 * confidence, not the orchestrator.
 */
export interface JsonRepairMetadata {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly repairsApplied: readonly string[];
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
  /** Null only when `status === "compilation_error"` — every other status compiled a real prompt. */
  readonly promptMetadata: PromptExecutionMetadata | null;
  readonly repairMetadata: JsonRepairMetadata;
}
