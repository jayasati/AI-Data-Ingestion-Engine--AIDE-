export { PROMPT_SECTION_IDS, type PromptSectionId, type PromptMessageRole } from "@/prompt/types";
export {
  DEFAULT_PROMPT_CONFIG,
  resolvePromptConfig,
  type PromptConfig,
} from "@/prompt/config/prompt-config";

export {
  hashPromptContent,
  buildPromptVersionMetadata,
  type PromptVersionMetadata,
} from "@/prompt/versioning/prompt-version";

export {
  PROMPT_CATEGORIES,
  PromptRegistry,
  PromptRegistryError,
  type PromptCategory,
  type PromptRegistryEntry,
  type PromptUsageStats,
} from "@/prompt/registry/prompt-registry";
export { DEFAULT_PROMPT_REGISTRY, PROMPT_VERSION } from "@/prompt/registry/default-prompt-registry";

export {
  buildBusinessRules,
  renderBusinessRules,
} from "@/prompt/business-rules/business-rule-builder";
export {
  DEFAULT_BUSINESS_RULE_PROFILE,
  getBusinessRuleProfile,
} from "@/prompt/business-rules/business-rule-profiles";
export type {
  BusinessRule,
  BusinessRuleProfile,
} from "@/prompt/business-rules/business-rule-types";

export {
  NEGATIVE_EXAMPLES,
  selectNegativeExamples,
  type NegativeExample,
} from "@/prompt/examples/negative-example-registry";

export {
  buildOutputSchema,
  buildOutputSchemaDescription,
  type OutputFieldSchema,
  type OutputSchema,
} from "@/prompt/schema/schema-builder";

export {
  INJECTION_DEFENSE_STATEMENT,
  UNTRUSTED_DATA_BEGIN_MARKER,
  UNTRUSTED_DATA_END_MARKER,
  wrapUntrustedBatchPayload,
} from "@/prompt/security/injection-defense";

export * from "@/prompt/sections";

export type { PromptTemplate } from "@/prompt/templates/template-types";
export { CRM_EXTRACTION_TEMPLATE } from "@/prompt/templates/crm-extraction-template";
export {
  DEFAULT_TEMPLATE_REGISTRY,
  TemplateRegistry,
  TemplateRegistryError,
} from "@/prompt/templates/template-registry";

export {
  estimatePromptTokens,
  estimateTokenCount,
  estimateCostUsd,
  type TokenEstimate,
} from "@/prompt/tokens/token-estimator";

export {
  validatePrompt,
  type PromptValidationInput,
  type PromptValidationIssue,
  type PromptValidationResult,
  type PromptValidationSeverity,
} from "@/prompt/validator/prompt-validator";

export {
  optimizeSections,
  type OptimizableSection,
  type PromptOptimizationResult,
} from "@/prompt/optimizer/prompt-optimizer";

export {
  buildPromptExecutionMetadata,
  type PromptExecutionMetadata,
  type PromptExecutionMetadataInput,
} from "@/prompt/observability/prompt-observability";

export { buildPromptReport, type PromptReport } from "@/prompt/report/prompt-report";

export {
  compilePrompt,
  PromptCompilationError,
  type CompiledPrompt,
  type PromptCompilationInput,
} from "@/prompt/compiler/prompt-compiler";

export {
  benchmarkPromptVariants,
  comparePromptCompilations,
  type PromptBenchmarkVariant,
  type PromptBenchmarkOutcome,
  type PromptBenchmarkReport,
  type PromptBenchmarkComparison,
} from "@/prompt/benchmark/prompt-benchmark";
