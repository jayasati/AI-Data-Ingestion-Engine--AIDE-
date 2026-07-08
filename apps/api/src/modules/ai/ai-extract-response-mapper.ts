import type {
  AIExecutionReportDTO,
  AIExtractIssueDTO,
  AIExtractResponse,
  ExtractedFieldDTO,
  ExtractedRecordDTO,
} from "@aide/shared-types";
import type { AIExecutionReport, ParserDiagnostic } from "@/ai/contracts/execution";
import type { StageIssue } from "@/pipeline/contracts/stage-result";
import type { ExtractedField, ExtractedRecord } from "@/pipeline/domain/extraction";
import type { AIExtractResult } from "@/modules/ai/ai-extract.service";

/**
 * Translates the internal `AIExtractResult` (extraction + execution report)
 * into the wire-contract DTOs published by `@aide/shared-types`. Deliberately
 * excludes the compiled prompt and the provider's raw response text — the
 * spec is explicit that raw prompts are never exposed to a client.
 */
export function toAIExtractResponse(result: AIExtractResult): AIExtractResponse {
  return {
    implemented: true,
    records: result.extraction.records.map(toExtractedRecordDTO),
    recordCount: result.extraction.records.length,
    report: toAIExecutionReportDTO(result.report),
  };
}

function toExtractedRecordDTO(record: ExtractedRecord): ExtractedRecordDTO {
  return {
    rowNumber: record.rowNumber,
    fields: record.fields.map(toExtractedFieldDTO),
  };
}

function toExtractedFieldDTO(field: ExtractedField): ExtractedFieldDTO {
  return {
    sourceHeader: field.sourceHeader,
    targetField: field.targetField,
    value: field.value,
    confidence: field.confidence,
  };
}

function toIssueDTO(issue: StageIssue | ParserDiagnostic): AIExtractIssueDTO {
  return { code: issue.code, message: issue.message };
}

function toAIExecutionReportDTO(report: AIExecutionReport): AIExecutionReportDTO {
  return {
    requestId: report.requestId,
    provider: report.provider,
    model: report.model,
    promptVersion: report.promptVersion,
    schemaVersion: report.schemaVersion,
    startedAt: report.startedAt,
    completedAt: report.completedAt,
    latencyMs: report.latencyMs,
    tokenUsage: { ...report.tokenUsage },
    estimatedCostUsd: report.estimatedCostUsd,
    status: report.status,
    warnings: report.warnings.map(toIssueDTO),
    parserDiagnostics: report.parserDiagnostics.map(toIssueDTO),
  };
}
