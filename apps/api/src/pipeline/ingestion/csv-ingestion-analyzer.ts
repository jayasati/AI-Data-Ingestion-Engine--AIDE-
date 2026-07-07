import type { StageExecutionInfo } from "@/pipeline/contracts/stage-result";
import type { ParsedDataset } from "@/pipeline/domain/parsing";
import type { UploadedFile } from "@/pipeline/domain/upload";
import { buildColumnProfiles } from "@/pipeline/ingestion/column-profiler";
import { buildDatasetIntelligence } from "@/pipeline/ingestion/dataset-intelligence";
import { buildDatasetMetadata } from "@/pipeline/ingestion/dataset-profiler";
import { buildHeaderProfiles } from "@/pipeline/ingestion/header-engine";
import {
  DEFAULT_PREVIEW_OPTIONS,
  generatePreview,
  type DatasetPreview,
  type PreviewOptions,
} from "@/pipeline/ingestion/preview-generator";

export interface CsvIngestionAnalysisInput {
  readonly dataset: ParsedDataset;
  readonly uploadedFile: UploadedFile;
  /** The CSV Parsing stage's own StageExecutionInfo — reused for its warnings and blank-row count. */
  readonly parserStageInfo: StageExecutionInfo;
  readonly previewOptions?: PreviewOptions;
}

/**
 * Single entry point for the CSV Ingestion Engine's analysis layer: composes
 * the Header Engine, Column Profiler, Dataset Profiler, Dataset Intelligence,
 * and Preview Generator over an already-parsed dataset. Framework-free and
 * outside the PipelineRunner's fixed six-stage sequence — it is invoked
 * directly by the /preview HTTP flow once Upload and CSV Parsing have run.
 */
export function analyzeCsvIngestion(input: CsvIngestionAnalysisInput): DatasetPreview {
  const headerProfiles = buildHeaderProfiles(
    input.dataset.headers,
    input.dataset.headerDuplicateFlags,
  );
  const columnProfiles = buildColumnProfiles(input.dataset, headerProfiles);
  const datasetMetadata = buildDatasetMetadata(
    input.dataset,
    input.uploadedFile,
    input.parserStageInfo,
    headerProfiles,
    columnProfiles,
  );
  const datasetIntelligence = buildDatasetIntelligence(columnProfiles);

  return generatePreview(
    input.dataset,
    datasetMetadata,
    headerProfiles,
    columnProfiles,
    datasetIntelligence,
    input.parserStageInfo.warnings,
    input.previewOptions ?? DEFAULT_PREVIEW_OPTIONS,
  );
}
