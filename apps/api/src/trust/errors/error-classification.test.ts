import { describe, expect, it } from "vitest";
import {
  classifyApprovalDecision,
  classifyBusinessViolation,
  classifyFieldIssues,
  classifyParserDiagnostic,
  classifyRepairAction,
  classifySchemaIssue,
} from "@/trust/errors/error-classification";

describe("error-classification", () => {
  it("tags a schema issue with category 'schema'", () => {
    const result = classifySchemaIssue({
      field: "email",
      code: "MISSING_FIELD",
      message: "x",
      severity: "error",
    });
    expect(result.category).toBe("schema");
    expect(result.severity).toBe("error");
  });

  it("splits field errors and warnings into separate classified issues, both tagged 'validation'", () => {
    const result = classifyFieldIssues({ field: "email", errors: ["bad"], warnings: ["meh"] });
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.category === "validation")).toBe(true);
    expect(result.find((r) => r.severity === "error")?.message).toBe("bad");
    expect(result.find((r) => r.severity === "warning")?.message).toBe("meh");
  });

  it("tags a business rule violation with category 'business'", () => {
    const result = classifyBusinessViolation({
      code: "INVALID_CRM_STATUS",
      message: "x",
      severity: "error",
    });
    expect(result.category).toBe("business");
  });

  it("tags a parser diagnostic with category 'parser' and warning severity", () => {
    const result = classifyParserDiagnostic("JSON_REPAIRED", "x");
    expect(result.category).toBe("parser");
    expect(result.severity).toBe("warning");
  });

  it("tags a repair action with category 'repair'", () => {
    const result = classifyRepairAction({
      field: "email",
      kind: "trim_whitespace",
      originalValue: " a ",
      repairedValue: "a",
      reason: "x",
    });
    expect(result.category).toBe("repair");
    expect(result.code).toBe("REPAIR_TRIM_WHITESPACE");
  });

  it("returns null for an approved decision", () => {
    expect(classifyApprovalDecision({ status: "approved", reason: "x" })).toBeNull();
  });

  it("classifies a rejected decision as an error", () => {
    const result = classifyApprovalDecision({ status: "rejected", reason: "x" });
    expect(result?.category).toBe("approval");
    expect(result?.severity).toBe("error");
  });

  it("classifies a needs_review decision as a warning", () => {
    const result = classifyApprovalDecision({ status: "needs_review", reason: "x" });
    expect(result?.severity).toBe("warning");
  });
});
