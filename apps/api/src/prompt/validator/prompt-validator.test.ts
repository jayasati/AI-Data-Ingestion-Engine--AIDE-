import { describe, expect, it } from "vitest";
import { validatePrompt } from "@/prompt/validator/prompt-validator";
import { CRM_EXTRACTION_TEMPLATE } from "@/prompt/templates/crm-extraction-template";
import type { PromptSectionId } from "@/prompt/types";

const ALL_SECTIONS: ReadonlySet<PromptSectionId> = new Set([
  ...CRM_EXTRACTION_TEMPLATE.systemSections,
  ...CRM_EXTRACTION_TEMPLATE.userSections,
]);

function validPrompt() {
  return {
    template: CRM_EXTRACTION_TEMPLATE,
    sectionsPresent: ALL_SECTIONS,
    systemMessage: "# Identity\n...\n# Business Rules\n...",
    userMessage: '# Output Schema\n...\n{ "records": [] }',
    estimatedTokens: 500,
  };
}

describe("validatePrompt", () => {
  it("passes a well-formed compiled prompt with no issues", () => {
    const result = validatePrompt(validPrompt());
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("flags a missing required section as an error", () => {
    const sectionsPresent = new Set(ALL_SECTIONS);
    sectionsPresent.delete("identity");
    const result = validatePrompt({ ...validPrompt(), sectionsPresent });
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("MISSING_SECTION");
  });

  it("flags a missing optional section (negative_examples) as a warning, still valid", () => {
    const sectionsPresent = new Set(ALL_SECTIONS);
    sectionsPresent.delete("negative_examples");
    const result = validatePrompt({ ...validPrompt(), sectionsPresent });
    expect(result.valid).toBe(true);
    const issue = result.issues.find((i) => i.code === "MISSING_SECTION");
    expect(issue?.severity).toBe("warning");
  });

  it("detects an unresolved {{variable}} placeholder", () => {
    const result = validatePrompt({
      ...validPrompt(),
      userMessage: `${validPrompt().userMessage}\nHello {{name}}`,
    });
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("INVALID_VARIABLE");
  });

  it("flags a missing Output Schema section", () => {
    const result = validatePrompt({ ...validPrompt(), userMessage: '{ "records": [] }' });
    expect(result.issues.map((i) => i.code)).toContain("MISSING_SCHEMA");
  });

  it("flags a missing Business Rules section", () => {
    const result = validatePrompt({ ...validPrompt(), systemMessage: "# Identity\n..." });
    expect(result.issues.map((i) => i.code)).toContain("MISSING_BUSINESS_RULES");
  });

  it("flags a missing output contract (no 'records' key mentioned)", () => {
    const result = validatePrompt({ ...validPrompt(), userMessage: "# Output Schema\n..." });
    expect(result.issues.map((i) => i.code)).toContain("MISSING_OUTPUT_CONTRACT");
  });

  it("flags an oversized prompt", () => {
    const result = validatePrompt({
      ...validPrompt(),
      userMessage: `${validPrompt().userMessage}${"x".repeat(100_000)}`,
      config: {
        templateId: "crm-extraction",
        businessRuleProfileId: "default",
        schemaVersion: "v1.0",
        maxExamples: 2,
        maxNegativeExamples: 3,
        maxPromptSizeChars: 1000,
        optimizeByDefault: true,
      },
    });
    expect(result.issues.map((i) => i.code)).toContain("OVERSIZED_PROMPT");
  });

  it("flags a non-positive token estimate", () => {
    const result = validatePrompt({ ...validPrompt(), estimatedTokens: 0 });
    expect(result.issues.map((i) => i.code)).toContain("INVALID_TOKEN_ESTIMATE");
  });
});
