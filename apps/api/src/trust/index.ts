export {
  DEFAULT_TRUST_CONFIG,
  resolveTrustConfig,
  type QualityScoreWeights,
  type TrustConfig,
} from "@/trust/config/trust-config";

export {
  attemptJsonRepair,
  NO_JSON_REPAIR,
  type JsonRepairResult,
} from "@/trust/parser/json-repair";

export {
  validateSchema,
  isKnownCrmField,
  type SchemaValidationIssue,
  type SchemaValidationResult,
} from "@/trust/schema/schema-validator";

export {
  validateField,
  validateAllFields,
  type FieldValidationOutcome,
} from "@/trust/fields/field-validators";

export {
  validateBusinessRules,
  MULTI_VALUE_SPLIT_PATTERN,
  type BusinessRuleViolation,
} from "@/trust/business/business-rule-validator";

export { evaluateSkip } from "@/trust/skip/skip-engine";

export { repairField, type FieldRepairOutcome } from "@/trust/repair/field-repair-engine";

export {
  computeFieldConfidence,
  computeRecordConfidence,
  computeDatasetConfidence,
  type FieldConfidenceInput,
  type FieldConfidenceEntry,
  type RecordConfidenceInput,
} from "@/trust/confidence/confidence-engine";

export { computeQualityScore, type QualityScoreInput } from "@/trust/quality/quality-score";

export {
  decideApproval,
  type ApprovalInput,
  type ApprovalDecision,
} from "@/trust/approval/approval-engine";

export {
  classifySchemaIssue,
  classifyFieldIssues,
  classifyBusinessViolation,
  classifyParserDiagnostic,
  classifyRepairAction,
  classifyApprovalDecision,
  type FieldIssueSource,
} from "@/trust/errors/error-classification";

export { buildDatasetSummary } from "@/trust/reports/validation-report";

export { runTrustLayer, type TrustLayerInput } from "@/trust/trust-engine";

export type {
  ApprovalStatus,
  FieldValidationStatus,
  RepairStatus,
  TrustErrorCategory,
  ClassifiedIssue,
  RepairAction,
  FieldValidationReport,
  SkipDecision,
  ValidatedRecord,
  DatasetValidationSummary,
  ValidationResult,
} from "@/pipeline/domain/validation";
