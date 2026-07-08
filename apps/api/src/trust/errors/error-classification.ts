import type { ApprovalDecision } from "@/trust/approval/approval-engine";
import type { BusinessRuleViolation } from "@/trust/business/business-rule-validator";
import type { SchemaValidationIssue } from "@/trust/schema/schema-validator";
import type { ClassifiedIssue, RepairAction } from "@/pipeline/domain/validation";

/**
 * Tags every stage's own issue shape with a `TrustErrorCategory` so a
 * record's `classifiedIssues` can be filtered/grouped by which pipeline
 * stage raised them (parser, schema, validation, business, repair,
 * approval) without the caller needing to know each stage's internal type.
 */
export function classifySchemaIssue(issue: SchemaValidationIssue): ClassifiedIssue {
  return { category: "schema", code: issue.code, message: issue.message, severity: issue.severity };
}

export interface FieldIssueSource {
  readonly field: string;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

export function classifyFieldIssues(outcome: FieldIssueSource): readonly ClassifiedIssue[] {
  return [
    ...outcome.errors.map((message): ClassifiedIssue => ({
      category: "validation",
      code: "FIELD_VALIDATION_ERROR",
      message,
      severity: "error",
    })),
    ...outcome.warnings.map((message): ClassifiedIssue => ({
      category: "validation",
      code: "FIELD_VALIDATION_WARNING",
      message,
      severity: "warning",
    })),
  ];
}

export function classifyBusinessViolation(violation: BusinessRuleViolation): ClassifiedIssue {
  return {
    category: "business",
    code: violation.code,
    message: violation.message,
    severity: violation.severity,
  };
}

export function classifyParserDiagnostic(code: string, message: string): ClassifiedIssue {
  return { category: "parser", code, message, severity: "warning" };
}

export function classifyRepairAction(action: RepairAction): ClassifiedIssue {
  return {
    category: "repair",
    code: `REPAIR_${action.kind.toUpperCase()}`,
    message: action.reason,
    severity: "warning",
  };
}

/** Null for "approved" — nothing to report; every other status is worth surfacing as an issue. */
export function classifyApprovalDecision(decision: ApprovalDecision): ClassifiedIssue | null {
  if (decision.status === "approved") {
    return null;
  }
  return {
    category: "approval",
    code: `APPROVAL_${decision.status.toUpperCase()}`,
    message: decision.reason,
    severity: decision.status === "rejected" ? "error" : "warning",
  };
}
