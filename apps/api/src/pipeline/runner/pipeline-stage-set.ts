import type { PipelineStage } from "@/pipeline/contracts/pipeline-stage";
import type { UploadContext, RawUploadInput } from "@/pipeline/domain/upload";
import type { ParsedDataset } from "@/pipeline/domain/parsing";
import type { NormalizedDataset } from "@/pipeline/domain/normalization";
import type { SemanticExtractionResult } from "@/pipeline/domain/extraction";
import type { ValidationResult } from "@/pipeline/domain/validation";
import type { ImportSummary } from "@/pipeline/domain/import-summary";

/**
 * The six stages, in the only order the runner ever calls them. Injected as a
 * set (not hardcoded imports inside the runner) so tests can substitute stubs
 * for any stage without touching orchestration logic.
 */
export interface PipelineStageSet {
  readonly upload: PipelineStage<RawUploadInput, UploadContext>;
  readonly csvParsing: PipelineStage<UploadContext, ParsedDataset>;
  readonly normalization: PipelineStage<ParsedDataset, NormalizedDataset>;
  readonly semanticExtraction: PipelineStage<NormalizedDataset, SemanticExtractionResult>;
  readonly validation: PipelineStage<SemanticExtractionResult, ValidationResult>;
  readonly aggregation: PipelineStage<ValidationResult, ImportSummary>;
}
