import { describe, expect, it } from "vitest";
import { buildPromptReport } from "@/prompt/report/prompt-report";
import { buildPromptExecutionMetadata } from "@/prompt/observability/prompt-observability";

describe("buildPromptReport", () => {
  it("carries metadata through and adds businessRuleProfileId/schemaVersion", () => {
    const metadata = buildPromptExecutionMetadata({
      promptVersion: "v1.0",
      promptHash: "abc",
      templateId: "crm-extraction",
      examplesUsed: ["facebook-leads"],
      negativeExamplesUsed: ["company-to-lead-owner"],
      systemMessage: "sys",
      userMessage: "usr",
      tokenEstimate: {
        promptTokens: 10,
        estimatedCompletionTokens: 5,
        totalEstimatedTokens: 15,
        estimatedCostUsd: 0.001,
        maxContextTokens: 100_000,
        exceedsMaxContext: false,
      },
      compilationTimeMs: 2,
      validation: {
        valid: false,
        issues: [
          { code: "MISSING_SECTION", severity: "warning", message: "missing negative_examples" },
        ],
      },
    });

    const report = buildPromptReport(metadata, "default", "v1.0");
    expect(report.templateId).toBe("crm-extraction");
    expect(report.businessRuleProfileId).toBe("default");
    expect(report.schemaVersion).toBe("v1.0");
    expect(report.warnings).toEqual(["missing negative_examples"]);
    expect(report.estimatedCostUsd).toBe(0.001);
  });
});
