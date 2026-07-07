import { randomUUID } from "node:crypto";
import {
  analyzeCsvIngestion,
  CsvParsingStage,
  DEFAULT_PIPELINE_CONFIGURATION,
  PipelineContext,
  stageSucceeded,
  UploadStage,
  type DatasetPreview,
} from "@/pipeline";
import { toFileProcessingError } from "@/modules/preview/stage-failure";

export interface RawPreviewUpload {
  readonly fileName: string;
  readonly mimeType: string;
  readonly declaredSizeBytes: number;
  readonly content: string;
  readonly detectedEncoding: string;
}

export interface IPreviewService {
  previewUpload(upload: RawPreviewUpload): Promise<DatasetPreview>;
}

/**
 * Real implementation: reuses Volume 2's UploadStage and CsvParsingStage
 * exactly as the future full import pipeline will, then runs the CSV
 * Ingestion Engine's analysis layer over the result. Deliberately does not
 * run Normalization or anything past it — preview must stay AI-free and
 * side-effect-free, showing the file as parsed, not as it will eventually
 * be imported.
 */
export class PreviewService implements IPreviewService {
  private readonly uploadStage = new UploadStage();
  private readonly csvParsingStage = new CsvParsingStage();

  async previewUpload(upload: RawPreviewUpload): Promise<DatasetPreview> {
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

    return analyzeCsvIngestion({
      dataset: parseExecution.result.output,
      uploadedFile: uploadExecution.result.output.uploadedFile,
      parserStageInfo: parseExecution.result.info,
    });
  }
}
