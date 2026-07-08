import type { DatasetContext } from "@/ai/context/dataset-context-builder";
import { selectExamples, type FewShotExample } from "@/ai/prompt/example-registry";
import {
  buildBusinessRulesSection,
  buildCurrentBatchSection,
  buildDatasetContextSection,
  buildExamplesSection,
  buildIdentitySection,
  buildMissionSection,
  buildOutputSchemaSection,
} from "@/ai/prompt/prompt-sections";
import type { NormalizedRecord } from "@/pipeline/domain/normalization";

/**
 * Bumped whenever a prompt section's wording changes in a way that could
 * affect extraction quality. Every AIExecutionReport carries this, so past
 * runs stay attributable to the exact prompt that produced them.
 */
export const PROMPT_VERSION = "v1.0";

/** ~4 characters per token is a standard rough estimate for English text; not exact, never needs to be. */
const CHARS_PER_TOKEN_ESTIMATE = 4;

export interface PromptCompilationInput {
  readonly datasetContext: DatasetContext;
  readonly batch: readonly NormalizedRecord[];
  readonly supportsJsonMode: boolean;
  readonly exampleLimit?: number;
}

export interface CompiledPrompt {
  readonly systemMessage: string;
  readonly userMessage: string;
  readonly promptVersion: string;
  readonly examplesUsed: readonly FewShotExample["category"][];
  readonly estimatedTokens: number;
}

/**
 * Composes the seven prompt sections into a system message (identity,
 * mission, business rules — static, provider-agnostic instructions) and a
 * user message (dataset context, examples, output schema, current batch —
 * everything that varies per request). Every call recompiles from scratch;
 * nothing is cached or hardcoded per Volume 5's "compile at runtime" requirement.
 */
export function compilePrompt(input: PromptCompilationInput): CompiledPrompt {
  const examples = selectExamples(input.datasetContext, input.exampleLimit ?? 2);

  const systemMessage = [
    buildIdentitySection(),
    buildMissionSection(),
    buildBusinessRulesSection(),
  ].join("\n\n");

  const userMessage = [
    buildDatasetContextSection(input.datasetContext),
    buildExamplesSection(examples),
    buildOutputSchemaSection(input.supportsJsonMode),
    buildCurrentBatchSection(input.batch),
  ].join("\n\n");

  return {
    systemMessage,
    userMessage,
    promptVersion: PROMPT_VERSION,
    examplesUsed: examples.map((example) => example.category),
    estimatedTokens: Math.ceil(
      (systemMessage.length + userMessage.length) / CHARS_PER_TOKEN_ESTIMATE,
    ),
  };
}
