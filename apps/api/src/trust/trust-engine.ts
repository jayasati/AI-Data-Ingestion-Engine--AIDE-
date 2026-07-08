import type { ExtractedRecord, SemanticExtractionResult } from "@/pipeline/domain/extraction";
import type {
  ClassifiedIssue,
  FieldValidationReport,
  FieldValidationStatus,
  RepairAction,
  RepairStatus,
  ValidatedRecord,
  ValidationResult,
} from "@/pipeline/domain/validation";
import { decideApproval } from "@/trust/approval/approval-engine";
import { validateBusinessRules } from "@/trust/business/business-rule-validator";
import {
  computeFieldConfidence,
  computeRecordConfidence,
  type FieldConfidenceEntry,
} from "@/trust/confidence/confidence-engine";
import {
  DEFAULT_TRUST_CONFIG,
  resolveTrustConfig,
  type TrustConfig,
} from "@/trust/config/trust-config";
import {
  classifyApprovalDecision,
  classifyBusinessViolation,
  classifyFieldIssues,
  classifyRepairAction,
  classifySchemaIssue,
} from "@/trust/errors/error-classification";
import { validateField } from "@/trust/fields/field-validators";
import { computeQualityScore } from "@/trust/quality/quality-score";
import { repairField } from "@/trust/repair/field-repair-engine";
import { buildDatasetSummary } from "@/trust/reports/validation-report";
import { validateSchema } from "@/trust/schema/schema-validator";
import { evaluateSkip } from "@/trust/skip/skip-engine";

export interface TrustLayerInput {
  readonly extraction: SemanticExtractionResult;
  readonly config?: Partial<TrustConfig>;
}

/**
 * The Trust Layer's top-level entry point — the pipeline diagram made real:
 * Schema Validator -> Field Validator -> Business Rule Validator -> Repair
 * Engine -> Confidence Engine -> Approval Engine, run once per record, then
 * rolled up into a dataset summary. Mirrors `prompt/compiler/prompt-compiler.ts`'s
 * `compilePrompt()` role in the Prompt Engineering Platform: the one function
 * that ties every single-responsibility engine together. Never throws for a
 * malformed *record* — a record that fails every check comes back
 * `approvalStatus: "rejected"`, not an exception; only a genuine programming
 * error should ever throw here.
 */
export function runTrustLayer(input: TrustLayerInput): ValidationResult {
  const config = input.config ? resolveTrustConfig(input.config) : DEFAULT_TRUST_CONFIG;
  const records = input.extraction.records.map((record) => processRecord(record, config));
  return { records, summary: buildDatasetSummary(records) };
}

function processRecord(record: ExtractedRecord, config: TrustConfig): ValidatedRecord {
  const schemaResult = validateSchema(record);
  const skipDecision = evaluateSkip(record, config);

  const repairsApplied: RepairAction[] = [];
  const fieldReports: FieldValidationReport[] = [];
  const fieldConfidenceEntries: FieldConfidenceEntry[] = [];

  for (const field of record.fields) {
    const originalValue = field.value;
    const repairOutcome = repairField(field.targetField, originalValue, config);
    if (repairOutcome.action) {
      repairsApplied.push(repairOutcome.action);
    }

    const finalValue = repairOutcome.value;
    const fieldValidation = validateField(field.targetField, finalValue);
    const validationStatus: FieldValidationStatus = fieldValidation.status;
    const repairStatus: RepairStatus = !repairOutcome.action
      ? "not_repaired"
      : validationStatus === "invalid"
        ? "repair_failed"
        : "repaired";

    const confidence = computeFieldConfidence({
      extractionConfidence: field.confidence,
      validationStatus,
      wasRepaired: repairStatus === "repaired",
    });

    fieldReports.push({
      field: field.targetField,
      value: finalValue,
      originalValue,
      validationStatus,
      repairStatus,
      confidence,
      warnings: fieldValidation.warnings,
      errors: fieldValidation.errors,
    });
    fieldConfidenceEntries.push({ confidence, status: validationStatus });
  }

  // Business rules run against the post-repair values — the record the
  // Trust Layer is about to hand downstream, not the AI's raw output.
  const repairedRecord: ExtractedRecord = {
    rowNumber: record.rowNumber,
    fields: fieldReports.map((fr) => ({
      sourceHeader: "",
      targetField: fr.field,
      value: fr.value,
      confidence: fr.confidence,
    })),
  };
  const businessViolations = validateBusinessRules(repairedRecord);
  const businessErrorCount = businessViolations.filter((v) => v.severity === "error").length;
  const businessWarningCount = businessViolations.filter((v) => v.severity === "warning").length;

  const recordConfidence = computeRecordConfidence({
    fields: fieldConfidenceEntries,
    repairCount: repairsApplied.length,
    businessRuleErrorCount: businessErrorCount,
    businessRuleWarningCount: businessWarningCount,
  });

  const missingFieldCount = fieldReports.filter((fr) => fr.validationStatus === "missing").length;
  const presentExtractionConfidences = record.fields
    .filter((f) => f.value !== null)
    .map((f) => f.confidence);
  const semanticMatchAverage =
    presentExtractionConfidences.length > 0
      ? presentExtractionConfidences.reduce((sum, c) => sum + c, 0) /
        presentExtractionConfidences.length
      : 0;
  const validationErrorCount =
    fieldReports.reduce((sum, fr) => sum + fr.errors.length, 0) +
    schemaResult.issues.filter((issue) => issue.severity === "error").length;

  const qualityScore = computeQualityScore(
    {
      missingFieldCount,
      repairCount: repairsApplied.length,
      recordConfidence,
      semanticMatchAverage,
      businessRuleViolationCount: businessViolations.length,
      validationErrorCount,
    },
    config,
  );

  const approval = decideApproval(
    {
      skipped: skipDecision.skipped,
      skipReason: skipDecision.reason,
      hasSchemaErrors: !schemaResult.valid,
      hasBusinessRuleErrors: businessErrorCount > 0,
      recordConfidence,
      qualityScore,
      repairCount: repairsApplied.length,
    },
    config,
  );

  const classifiedIssues: ClassifiedIssue[] = [
    ...schemaResult.issues.map(classifySchemaIssue),
    ...fieldReports.flatMap((fr) => classifyFieldIssues(fr)),
    ...businessViolations.map(classifyBusinessViolation),
    ...repairsApplied.map(classifyRepairAction),
  ];
  const approvalIssue = classifyApprovalDecision(approval);
  if (approvalIssue) {
    classifiedIssues.push(approvalIssue);
  }

  return {
    rowNumber: record.rowNumber,
    isValid: approval.status !== "rejected",
    confidenceScore: recordConfidence,
    issues: classifiedIssues.map((issue) => issue.message),
    approvalStatus: approval.status,
    approvalReason: approval.reason,
    qualityScore,
    skipped: skipDecision.skipped,
    skipReason: skipDecision.reason,
    repairCount: repairsApplied.length,
    repairsApplied,
    fields: fieldReports,
    classifiedIssues,
  };
}
