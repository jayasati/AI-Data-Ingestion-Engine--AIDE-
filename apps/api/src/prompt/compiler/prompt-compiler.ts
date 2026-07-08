import type { DatasetContext } from "@/ai/context/dataset-context-builder";
import type { NormalizedDataset, NormalizedRecord } from "@/pipeline/domain/normalization";
import type { ColumnSemanticProfile } from "@/semantic/column-intelligence/column-analyzer";
import { getBusinessRuleProfile } from "@/prompt/business-rules/business-rule-profiles";
import {
  DEFAULT_PROMPT_CONFIG,
  resolvePromptConfig,
  type PromptConfig,
} from "@/prompt/config/prompt-config";
import { optimizeSections, type OptimizableSection } from "@/prompt/optimizer/prompt-optimizer";
import {
  buildPromptExecutionMetadata,
  type PromptExecutionMetadata,
} from "@/prompt/observability/prompt-observability";
import { buildPromptReport, type PromptReport } from "@/prompt/report/prompt-report";
import { DEFAULT_PROMPT_REGISTRY, PROMPT_VERSION } from "@/prompt/registry/default-prompt-registry";
import type { PromptRegistry } from "@/prompt/registry/prompt-registry";
import {
  buildBusinessRulesSection,
  buildCurrentBatchSection,
  buildDatasetContextSection,
  buildExamplesSection,
  buildIdentitySection,
  buildMissionSection,
  buildNegativeExamplesSection,
  buildOutputSchemaSection,
} from "@/prompt/sections";
import { DEFAULT_TEMPLATE_REGISTRY, TemplateRegistry } from "@/prompt/templates/template-registry";
import { estimatePromptTokens } from "@/prompt/tokens/token-estimator";
import type { PromptSectionId } from "@/prompt/types";
import { validatePrompt, type PromptValidationResult } from "@/prompt/validator/prompt-validator";
import { hashPromptContent } from "@/prompt/versioning/prompt-version";

export interface PromptCompilationInput {
  readonly datasetContext: DatasetContext;
  readonly normalizationReport: NormalizedDataset["report"];
  readonly columnProfiles?: readonly ColumnSemanticProfile[];
  readonly batch: readonly NormalizedRecord[];
  readonly supportsJsonMode: boolean;
  readonly model: string;
  readonly maxContextTokens: number;
  readonly config?: Partial<PromptConfig>;
  readonly templateRegistry?: TemplateRegistry;
  readonly promptRegistry?: PromptRegistry;
}

export interface CompiledPrompt {
  readonly systemMessage: string;
  readonly userMessage: string;
  /** Kept name-compatible with Volume 5's `CompiledPrompt.promptVersion`. */
  readonly promptVersion: string;
  readonly examplesUsed: readonly string[];
  readonly negativeExamplesUsed: readonly string[];
  /** Kept name-compatible with Volume 5's `CompiledPrompt.estimatedTokens` — equal to `metadata.estimatedPromptTokens`. */
  readonly estimatedTokens: number;
  readonly templateId: string;
  readonly promptHash: string;
  readonly compilationTimeMs: number;
  readonly validation: PromptValidationResult;
  readonly metadata: PromptExecutionMetadata;
  readonly report: PromptReport;
}

export class PromptCompilationError extends Error {
  constructor(
    message: string,
    readonly validation: PromptValidationResult,
  ) {
    super(message);
    this.name = "PromptCompilationError";
  }
}

/**
 * The Prompt Compiler: Instruction Builder (identity+mission) + Business
 * Rule Builder + Dataset Context Builder + Example Selector + Negative
 * Example Selector + Output Schema Builder -> assemble -> optimize (unless
 * disabled) -> validate -> observability metadata + report. Throws
 * `PromptCompilationError` only on a hard validation failure (missing
 * schema/business-rules/output-contract, oversized prompt, invalid token
 * estimate, or an unresolved template variable) — everything else about
 * compilation is deterministic and cannot fail on its own.
 */
export function compilePrompt(input: PromptCompilationInput): CompiledPrompt {
  const startedAt = Date.now();
  const config = input.config ? resolvePromptConfig(input.config) : DEFAULT_PROMPT_CONFIG;
  const templateRegistry = input.templateRegistry ?? DEFAULT_TEMPLATE_REGISTRY;
  const promptRegistry = input.promptRegistry ?? DEFAULT_PROMPT_REGISTRY;
  const template = templateRegistry.require(config.templateId);
  const businessRuleProfile = getBusinessRuleProfile(config.businessRuleProfileId);

  const sectionsPresent = new Set<PromptSectionId>();
  const rawSections: OptimizableSection[] = [];
  let examplesUsed: readonly string[] = [];
  let negativeExamplesUsed: readonly string[] = [];

  const addSection = (id: PromptSectionId, text: string): void => {
    rawSections.push({ id, text });
    if (text.trim().length > 0) {
      sectionsPresent.add(id);
    }
  };

  addSection("identity", buildIdentitySection());
  addSection("mission", buildMissionSection());
  addSection("business_rules", buildBusinessRulesSection(businessRuleProfile));
  addSection(
    "dataset_context",
    buildDatasetContextSection({
      datasetContext: input.datasetContext,
      normalizationReport: input.normalizationReport,
      columnProfiles: input.columnProfiles,
    }),
  );

  const examples = buildExamplesSection(input.datasetContext, config.maxExamples);
  addSection("examples", examples.text);
  examplesUsed = examples.examplesUsed;

  const negativeExamples = buildNegativeExamplesSection(config.maxNegativeExamples);
  addSection("negative_examples", negativeExamples.text);
  negativeExamplesUsed = negativeExamples.negativeExamplesUsed;

  addSection(
    "output_schema",
    buildOutputSchemaSection(input.supportsJsonMode, config.schemaVersion),
  );
  addSection("current_batch", buildCurrentBatchSection(input.batch));

  const assembledSections = config.optimizeByDefault
    ? optimizeSections(rawSections).sections
    : rawSections;
  const textBySectionId = new Map(assembledSections.map((section) => [section.id, section.text]));

  const systemMessage = template.systemSections
    .map((id) => textBySectionId.get(id))
    .filter((text): text is string => Boolean(text))
    .join("\n\n");

  // Explicit reassembly by template order (not optimizer output order) guarantees
  // "current_batch" stays last — required for MockProvider's batch scan.
  const userMessage = template.userSections
    .map((id) => textBySectionId.get(id))
    .filter((text): text is string => Boolean(text))
    .join("\n\n");

  const tokenEstimate = estimatePromptTokens(
    systemMessage,
    userMessage,
    input.model,
    input.maxContextTokens,
    input.batch.length,
  );

  const validation = validatePrompt({
    template,
    sectionsPresent,
    systemMessage,
    userMessage,
    estimatedTokens: tokenEstimate.promptTokens,
    config,
  });

  if (!validation.valid) {
    throw new PromptCompilationError(
      `Prompt compilation failed validation: ${validation.issues.map((i) => i.message).join(" | ")}`,
      validation,
    );
  }

  const promptHash = hashPromptContent(`${systemMessage} ${userMessage}`);
  const compilationTimeMs = Date.now() - startedAt;

  const metadata = buildPromptExecutionMetadata({
    promptVersion: PROMPT_VERSION,
    promptHash,
    templateId: template.id,
    examplesUsed,
    negativeExamplesUsed,
    systemMessage,
    userMessage,
    tokenEstimate,
    compilationTimeMs,
    validation,
  });

  const report = buildPromptReport(metadata, config.businessRuleProfileId, config.schemaVersion);

  promptRegistry.recordUsage(template.id, PROMPT_VERSION);

  return {
    systemMessage,
    userMessage,
    promptVersion: PROMPT_VERSION,
    examplesUsed,
    negativeExamplesUsed,
    estimatedTokens: tokenEstimate.promptTokens,
    templateId: template.id,
    promptHash,
    compilationTimeMs,
    validation,
    metadata,
    report,
  };
}
