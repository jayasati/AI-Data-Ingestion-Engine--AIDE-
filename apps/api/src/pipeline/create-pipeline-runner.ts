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
 */
export function createPipelineRunner(logger?: Logger): PipelineRunner {
  return new PipelineRunner(
    {
      upload: new UploadStage(),
      csvParsing: new CsvParsingStage(),
      normalization: new NormalizationStage(),
      semanticExtraction: new SemanticExtractionStage(),
      validation: new ValidationStage(),
      aggregation: new AggregationStage(),
    },
    new PipelineEventBus(),
    logger,
  );
}
