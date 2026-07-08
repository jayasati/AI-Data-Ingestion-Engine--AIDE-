import { DEFAULT_PROMPT_CONFIG, type PromptConfig } from "@/prompt/config/prompt-config";
import type { PromptSectionId } from "@/prompt/types";
import type { PromptTemplate } from "@/prompt/templates/template-types";

export type PromptValidationSeverity = "error" | "warning";

export interface PromptValidationIssue {
  readonly code: string;
  readonly severity: PromptValidationSeverity;
  readonly message: string;
}

export interface PromptValidationResult {
  /** True iff there are no `"error"`-severity issues — warnings alone don't block execution. */
  readonly valid: boolean;
  readonly issues: readonly PromptValidationIssue[];
}

export interface PromptValidationInput {
  readonly template: PromptTemplate;
  readonly sectionsPresent: ReadonlySet<PromptSectionId>;
  readonly systemMessage: string;
  readonly userMessage: string;
  readonly estimatedTokens: number;
  readonly config?: PromptConfig;
}

/** Sections whose absence is a soft warning, not a hard error — an empty result (e.g. no matching negative examples) is still a usable prompt. */
const OPTIONAL_SECTIONS: ReadonlySet<PromptSectionId> = new Set(["negative_examples", "examples"]);

const VARIABLE_PLACEHOLDER_PATTERN = /\{\{\s*[\w.]+\s*\}\}/;

/**
 * Checks a compiled prompt before it's ever sent: missing sections, stray
 * unresolved template variables, oversized prompt, an implausible token
 * estimate, and the presence of the schema/business-rules/output-contract
 * text a compiled prompt must always carry. Diagnostics, never a throw — the
 * caller (the Prompt Compiler) decides whether an invalid prompt still runs.
 */
export function validatePrompt(input: PromptValidationInput): PromptValidationResult {
  const config = input.config ?? DEFAULT_PROMPT_CONFIG;
  const issues: PromptValidationIssue[] = [];

  for (const sectionId of [...input.template.systemSections, ...input.template.userSections]) {
    if (input.sectionsPresent.has(sectionId)) {
      continue;
    }
    issues.push({
      code: "MISSING_SECTION",
      severity: OPTIONAL_SECTIONS.has(sectionId) ? "warning" : "error",
      message: `Template "${input.template.id}" expects a "${sectionId}" section, but it was not produced.`,
    });
  }

  const combined = `${input.systemMessage}\n${input.userMessage}`;
  const variableMatch = VARIABLE_PLACEHOLDER_PATTERN.exec(combined);
  if (variableMatch) {
    issues.push({
      code: "INVALID_VARIABLE",
      severity: "error",
      message: `Unresolved template variable "${variableMatch[0]}" found in the compiled prompt.`,
    });
  }

  if (!input.userMessage.includes("# Output Schema")) {
    issues.push({
      code: "MISSING_SCHEMA",
      severity: "error",
      message: 'Compiled prompt has no "# Output Schema" section.',
    });
  }

  if (!input.systemMessage.includes("# Business Rules")) {
    issues.push({
      code: "MISSING_BUSINESS_RULES",
      severity: "error",
      message: 'Compiled prompt has no "# Business Rules" section.',
    });
  }

  if (!input.userMessage.includes('"records"')) {
    issues.push({
      code: "MISSING_OUTPUT_CONTRACT",
      severity: "error",
      message: 'Compiled prompt never states the required top-level "records" response shape.',
    });
  }

  const promptSizeChars = input.systemMessage.length + input.userMessage.length;
  if (promptSizeChars > config.maxPromptSizeChars) {
    issues.push({
      code: "OVERSIZED_PROMPT",
      severity: "error",
      message: `Compiled prompt is ${promptSizeChars} characters, exceeding the ${config.maxPromptSizeChars}-character limit.`,
    });
  }

  if (!Number.isFinite(input.estimatedTokens) || input.estimatedTokens <= 0) {
    issues.push({
      code: "INVALID_TOKEN_ESTIMATE",
      severity: "error",
      message: `Token estimate must be a positive number (received ${input.estimatedTokens}).`,
    });
  }

  return { valid: !issues.some((issue) => issue.severity === "error"), issues };
}
