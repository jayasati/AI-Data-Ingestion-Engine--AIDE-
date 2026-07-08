import { randomUUID } from "node:crypto";
import { AIOrchestrator, createProvider, readAIExecutionReport } from "@/ai";
import type { AIExecutionReport } from "@/ai/contracts/execution";
import { loadAIConfig, type AIConfig } from "@/config/ai-config";
import {
  CsvParsingStage,
  DEFAULT_PIPELINE_CONFIGURATION,
  NormalizationStage,
  PipelineContext,
  SemanticExtractionStage,
  stageSucceeded,
  UploadStage,
  ValidationStage,
  type SemanticExtractionResult,
  type ValidationResult,
} from "@/pipeline";
import { toFileProcessingError } from "@/modules/ai/stage-failure";

export interface RawAIExtractUpload {
  readonly fileName: string;
  readonly mimeType: string;
  readonly declaredSizeBytes: number;
  readonly content: string;
  readonly detectedEncoding: string;
}

export interface AIExtractResult {
  readonly extraction: SemanticExtractionResult;
  readonly validation: ValidationResult;
  readonly report: AIExecutionReport;
}

export interface IAIExtractService {
  extract(upload: RawAIExtractUpload): Promise<AIExtractResult>;
}

/**
 * Diagnostic endpoint for the AI Orchestration Platform: runs Upload -> CSV
 * Parsing -> Normalization -> Semantic Extraction -> Validation directly
 * through the same stage classes `createPipelineRunner` wires up, so this
 * exercises the real AIOrchestrator + provider + parser + schema validator +
 * Trust Layer, not a stub. Stops right after Validation rather than going
 * through `PipelineRunner`, because Aggregation is still a not-yet-implemented
 * placeholder stage (see its README) that would otherwise always halt the
 * run — this module exists specifically so the AI + Trust layers are
 * observable over HTTP without waiting on that later volume.
 */
export class AIExtractService implements IAIExtractService {
  private readonly uploadStage = new UploadStage();
  private readonly csvParsingStage = new CsvParsingStage();
  private readonly normalizationStage = new NormalizationStage();
  private readonly semanticExtractionStage: SemanticExtractionStage;
  private readonly validationStage = new ValidationStage();

  constructor(aiConfig: AIConfig = loadAIConfig()) {
    const provider = createProvider(aiConfig);
    this.semanticExtractionStage = new SemanticExtractionStage(
      new AIOrchestrator(provider, aiConfig),
    );
  }

  async extract(upload: RawAIExtractUpload): Promise<AIExtractResult> {
    const context = PipelineContext.create(randomUUID(), DEFAULT_PIPELINE_CONFIGURATION);

    const uploadExecution = await this.uploadStage.execute(upload, context);
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

    const extractExecution = await this.semanticExtractionStage.execute(
      normalizeExecution.result.output,
      normalizeExecution.context,
    );
    if (!stageSucceeded(extractExecution.result)) {
      throw toFileProcessingError("semantic-extraction", extractExecution.result.info);
    }

    const report = readAIExecutionReport(extractExecution.context);
    if (!report) {
      throw toFileProcessingError("semantic-extraction", extractExecution.result.info);
    }

    const validateExecution = await this.validationStage.execute(
      extractExecution.result.output,
      extractExecution.context,
    );
    if (!stageSucceeded(validateExecution.result)) {
      throw toFileProcessingError("validation", validateExecution.result.info);
    }

    return {
      extraction: extractExecution.result.output,
      validation: validateExecution.result.output,
      report,
    };
  }
}
