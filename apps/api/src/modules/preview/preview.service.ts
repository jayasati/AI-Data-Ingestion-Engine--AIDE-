import { randomUUID } from "node:crypto";
import {
  analyzeCsvIngestion,
  buildNormalizationSummary,
  CsvParsingStage,
  DEFAULT_PIPELINE_CONFIGURATION,
  NormalizationStage,
  PipelineContext,
  stageSucceeded,
  UploadStage,
  type DatasetPreview,
  type NormalizationSummary,
} from "@/pipeline";
import type { StageIssue } from "@/pipeline/contracts/stage-result";
import { toFileProcessingError } from "@/modules/preview/stage-failure";
import { analyzeSemantics, type SemanticAnalysisResult } from "@/semantic/semantic-engine";

export interface RawPreviewUpload {
  readonly fileName: string;
  readonly mimeType: string;
  readonly declaredSizeBytes: number;
  readonly content: string;
  readonly detectedEncoding: string;
}

export interface PreviewResult {
  readonly preview: DatasetPreview;
  readonly normalization: NormalizationSummary;
  /** Stage-level aggregate warnings (e.g. "3 phone field(s) had no determinable country code"). */
  readonly normalizationWarnings: readonly StageIssue[];
  readonly semantics: SemanticAnalysisResult;
}

export interface IPreviewService {
  previewUpload(upload: RawPreviewUpload): Promise<PreviewResult>;
}

/**
 * Real implementation: reuses Volume 2's UploadStage, CsvParsingStage, and
 * (as of this volume) NormalizationStage directly — the same classes the
 * future full import pipeline will use — then runs the CSV Ingestion
 * Engine's analysis layer, the Normalization Engine's summary builder, and
 * the Semantic Intelligence Engine over the results. Deliberately stops
 * before Semantic Extraction (the AI call itself): preview must stay
 * AI-free, but both normalization and semantic analysis are pure
 * deterministic transforms with no side effects, so surfacing their results
 * here (rather than only at import time) gives the user a trustworthy
 * preview of what import will do to their data before they commit to it.
 */
export class PreviewService implements IPreviewService {
  private readonly uploadStage = new UploadStage();
  private readonly csvParsingStage = new CsvParsingStage();
  private readonly normalizationStage = new NormalizationStage();

  async previewUpload(upload: RawPreviewUpload): Promise<PreviewResult> {
    const context = PipelineContext.create(randomUUID(), DEFAULT_PIPELINE_CONFIGURATION);

    const uploadExecution = await this.uploadStage.execute(
      {
        fileName: upload.fileName,
        mimeType: upload.mimeType,
        declaredSizeBytes: upload.declaredSizeBytes,
        content: upload.content,
        detectedEncoding: upload.detectedEncoding,
      },
      context,
    );

    if (!stageSucceeded(uploadExecution.result)) {
      throw toFileProcessingError("upload", uploadExecution.result.info);
    }

    const parseExecution = await this.csvParsingStage.execute(
      uploadExecution.result.output,
      uploadExecution.context,
    );

    if (!stageSucceeded(parseExecution.result)) {
      throw toFileProcessingError("csv-parsing", parseExecution.result.info);
    }

    const normalizeExecution = await this.normalizationStage.execute(
      parseExecution.result.output,
      parseExecution.context,
    );

    if (!stageSucceeded(normalizeExecution.result)) {
      throw toFileProcessingError("normalization", normalizeExecution.result.info);
    }

    const preview = analyzeCsvIngestion({
      dataset: parseExecution.result.output,
      uploadedFile: uploadExecution.result.output.uploadedFile,
      parserStageInfo: parseExecution.result.info,
    });

    const normalization = buildNormalizationSummary(normalizeExecution.result.output);
    const semantics = analyzeSemantics(normalizeExecution.result.output);

    return {
      preview,
      normalization,
      normalizationWarnings: normalizeExecution.result.info.warnings,
      semantics,
    };
  }
}
