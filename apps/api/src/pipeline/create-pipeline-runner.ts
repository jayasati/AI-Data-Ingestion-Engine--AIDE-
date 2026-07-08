import { AIOrchestrator } from "@/ai/orchestrator";
import { createProvider } from "@/ai/providers";
import { loadAIConfig, type AIConfig } from "@/config/ai-config";
import type { Logger } from "@/core/logger";
import { AggregationStage } from "@/pipeline/stages/aggregation";
import { CsvParsingStage } from "@/pipeline/stages/csv-parsing";
import { NormalizationStage } from "@/pipeline/stages/normalization";
import { SemanticExtractionStage } from "@/pipeline/stages/semantic-extraction";
import { UploadStage } from "@/pipeline/stages/upload";
import { ValidationStage } from "@/pipeline/stages/validation";
import { PipelineEventBus } from "@/pipeline/events";
import { PipelineRunner } from "@/pipeline/runner/pipeline-runner";

/**
 * Composition root for the pipeline, mirroring `core/container.ts`: the only
 * place concrete stage implementations are chosen. A future HTTP module
 * calls this instead of constructing `PipelineRunner` by hand, so replacing a
 * placeholder stage with its real implementation touches this file alone.
 * The AI provider is selected once here, from `AIConfig` — no other file
 * ever chooses between OpenAI/Gemini/Claude/Mock.
 */
export function createPipelineRunner(
  logger?: Logger,
  aiConfig: AIConfig = loadAIConfig(),
): PipelineRunner {
  const provider = createProvider(aiConfig);
  const orchestrator = new AIOrchestrator(provider, aiConfig, logger);

  return new PipelineRunner(
    {
      upload: new UploadStage(),
      csvParsing: new CsvParsingStage(),
      normalization: new NormalizationStage(),
      semanticExtraction: new SemanticExtractionStage(orchestrator),
      validation: new ValidationStage(),
      aggregation: new AggregationStage(),
    },
    new PipelineEventBus(),
    logger,
  );
}
