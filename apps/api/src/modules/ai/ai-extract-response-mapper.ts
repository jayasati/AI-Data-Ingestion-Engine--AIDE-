import type {
  AIExecutionReportDTO,
  AIExtractIssueDTO,
  AIExtractResponse,
  ClassifiedIssueDTO,
  DatasetValidationSummaryDTO,
  ExtractedFieldDTO,
  ExtractedRecordDTO,
  FieldValidationReportDTO,
  PromptExecutionMetadataDTO,
  RepairActionDTO,
  ValidatedRecordDTO,
  ValidationResultDTO,
} from "@aide/shared-types";
import type { AIExecutionReport, ParserDiagnostic } from "@/ai/contracts/execution";
import type { StageIssue } from "@/pipeline/contracts/stage-result";
import type { ExtractedField, ExtractedRecord } from "@/pipeline/domain/extraction";
import type {
  ClassifiedIssue,
  DatasetValidationSummary,
  FieldValidationReport,
  RepairAction,
  ValidatedRecord,
  ValidationResult,
} from "@/pipeline/domain/validation";
import type { AIExtractResult } from "@/modules/ai/ai-extract.service";
import type { PromptExecutionMetadata } from "@/prompt";

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
    validation: toValidationResultDTO(result.validation),
    report: toAIExecutionReportDTO(result.report),
  };
}

function toValidationResultDTO(validation: ValidationResult): ValidationResultDTO {
  return {
    records: validation.records.map(toValidatedRecordDTO),
    summary: toDatasetValidationSummaryDTO(validation.summary),
  };
}

function toValidatedRecordDTO(record: ValidatedRecord): ValidatedRecordDTO {
  return {
    rowNumber: record.rowNumber,
    isValid: record.isValid,
    confidenceScore: record.confidenceScore,
    issues: record.issues,
    approvalStatus: record.approvalStatus,
    approvalReason: record.approvalReason,
    qualityScore: record.qualityScore,
    skipped: record.skipped,
    skipReason: record.skipReason,
    repairCount: record.repairCount,
    repairsApplied: record.repairsApplied.map(toRepairActionDTO),
    fields: record.fields.map(toFieldValidationReportDTO),
    classifiedIssues: record.classifiedIssues.map(toClassifiedIssueDTO),
  };
}

function toRepairActionDTO(action: RepairAction): RepairActionDTO {
  return { ...action };
}

function toFieldValidationReportDTO(report: FieldValidationReport): FieldValidationReportDTO {
  return { ...report };
}

function toClassifiedIssueDTO(issue: ClassifiedIssue): ClassifiedIssueDTO {
  return { ...issue };
}

function toDatasetValidationSummaryDTO(
  summary: DatasetValidationSummary,
): DatasetValidationSummaryDTO {
  return { ...summary };
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
    promptMetadata: report.promptMetadata
      ? toPromptExecutionMetadataDTO(report.promptMetadata)
      : null,
    repairMetadata: { ...report.repairMetadata },
  };
}

function toPromptExecutionMetadataDTO(
  metadata: PromptExecutionMetadata,
): PromptExecutionMetadataDTO {
  return {
    promptVersion: metadata.promptVersion,
    promptHash: metadata.promptHash,
    templateId: metadata.templateId,
    examplesUsed: metadata.examplesUsed,
    negativeExamplesUsed: metadata.negativeExamplesUsed,
    contextSizeChars: metadata.contextSizeChars,
    estimatedPromptTokens: metadata.estimatedPromptTokens,
    estimatedCompletionTokens: metadata.estimatedCompletionTokens,
    estimatedCostUsd: metadata.estimatedCostUsd,
    compilationTimeMs: metadata.compilationTimeMs,
    validationWarnings: metadata.validation.issues.map((issue) => issue.message),
  };
}
