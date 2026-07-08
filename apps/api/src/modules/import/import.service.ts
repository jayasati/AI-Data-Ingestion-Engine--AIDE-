import { randomUUID } from "node:crypto";
import {
  ImportStatus,
  type BatchSummaryDTO,
  type ImportAccepted,
  type ResultSummary,
} from "@aide/shared-types";
import { AIOrchestrator, createProvider } from "@/ai";
import { loadAIConfig, type AIConfig } from "@/config/ai-config";
import { NotFoundError } from "@/core/errors";
import type { Logger } from "@/core/logger";
import {
  CsvParsingStage,
  DEFAULT_PIPELINE_CONFIGURATION,
  NormalizationStage,
  PipelineContext,
  SemanticExtractionStage,
  stageSucceeded,
  UploadStage,
  ValidationStage,
} from "@/pipeline";
import type { ParsedDataset } from "@/pipeline/domain/parsing";
import {
  computeProgress,
  ExecutionEngine,
  ExecutionEventBus,
  ExecutionState,
  loadExecutionConfig,
  type ExecutionConfig,
  type ImportResult,
  type WorkerStageSet,
} from "@/execution";
import { toFileProcessingError } from "@/modules/import/stage-failure";

export interface RawImportUpload {
  readonly fileName: string;
  readonly mimeType: string;
  readonly declaredSizeBytes: number;
  readonly content: string;
  readonly detectedEncoding: string;
}

export interface IImportService {
  startImport(upload: RawImportUpload): Promise<ImportAccepted>;
  getImportResult(importId: string): ResultSummary;
}

/** Live state tracked while an execution runs in the background, via ExecutionEventBus subscriptions. */
interface ExecutionRecord {
  status: ImportStatus;
  parsedDataset: ParsedDataset;
  startedAt: string;
  currentStage: string | null;
  currentBatchId: string | null;
  completedRecords: number;
  result: ImportResult | null;
  errorMessage: string | null;
}

const BATCH_STATUS_VALUES = new Set<BatchSummaryDTO["status"]>([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

function toBatchStatus(status: string): BatchSummaryDTO["status"] {
  return BATCH_STATUS_VALUES.has(status as BatchSummaryDTO["status"])
    ? (status as BatchSummaryDTO["status"])
    : "failed";
}

function toImportStatus(state: ExecutionState): ImportStatus {
  switch (state) {
    case ExecutionState.Completed:
      return ImportStatus.Completed;
    case ExecutionState.Cancelled:
      return ImportStatus.Cancelled;
    case ExecutionState.Failed:
      return ImportStatus.Failed;
    default:
      return ImportStatus.Processing;
  }
}

/**
 * The real implementation `import.service.ts`'s original placeholder
 * anticipated: dispatches to the Execution Platform (`@/execution`) and
 * reads results from an in-memory store (no persistence layer exists yet —
 * consistent with every earlier volume's scope). `startImport` runs Upload
 * and CSV Parsing synchronously (fast, deterministic — any failure there is
 * a genuine 4xx before the client even gets an importId back), then fires
 * `ExecutionEngine.run()` in the background and returns 202 immediately.
 * Live progress comes from subscribing to that run's own `ExecutionEventBus`
 * — `ImportService` has no other way to observe an execution already in
 * flight, since `ExecutionContext` itself is internal to the engine.
 */
export class ImportService implements IImportService {
  private readonly executions = new Map<string, ExecutionRecord>();
  private readonly uploadStage = new UploadStage();
  private readonly csvParsingStage = new CsvParsingStage();
  private readonly workerStages: WorkerStageSet;
  private readonly executionEngine = new ExecutionEngine();
  private readonly executionConfig: ExecutionConfig;

  constructor(
    aiConfig: AIConfig = loadAIConfig(),
    executionConfig: ExecutionConfig = loadExecutionConfig(),
    private readonly logger?: Logger,
  ) {
    const provider = createProvider(aiConfig);
    this.workerStages = {
      normalization: new NormalizationStage(),
      semanticExtraction: new SemanticExtractionStage(
        new AIOrchestrator(provider, aiConfig, logger),
      ),
      validation: new ValidationStage(),
    };
    this.executionConfig = executionConfig;
  }

  async startImport(upload: RawImportUpload): Promise<ImportAccepted> {
    const importId = randomUUID();
    const context = PipelineContext.create(importId, DEFAULT_PIPELINE_CONFIGURATION);

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

    const parsedDataset = parseExecution.result.output;
    this.executions.set(importId, {
      status: ImportStatus.Processing,
      parsedDataset,
      startedAt: new Date().toISOString(),
      currentStage: null,
      currentBatchId: null,
      completedRecords: 0,
      result: null,
      errorMessage: null,
    });

    void this.runInBackground(importId, parsedDataset);

    return { importId, status: ImportStatus.Pending };
  }

  private async runInBackground(importId: string, parsedDataset: ParsedDataset): Promise<void> {
    const eventBus = new ExecutionEventBus();
    eventBus.subscribe((event) => {
      const record = this.executions.get(importId);
      if (!record) {
        return;
      }
      if (event.type === "BatchStarted") {
        record.currentBatchId = event.batchId;
        record.currentStage = "normalization";
      } else if (event.type === "BatchCompleted") {
        record.completedRecords += event.result.statistics.recordCount ?? 0;
      }
    });

    try {
      const { result } = await this.executionEngine.run({
        importId,
        parsedDataset,
        stages: this.workerStages,
        config: this.executionConfig,
        eventBus,
        logger: this.logger,
      });
      const record = this.executions.get(importId);
      if (!record) {
        return;
      }
      record.result = result;
      record.status = toImportStatus(result.finalState);
      record.currentStage = null;
      record.currentBatchId = null;
    } catch (error) {
      const record = this.executions.get(importId);
      if (!record) {
        return;
      }
      record.status = ImportStatus.Failed;
      record.errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error("import.execution.unexpected_error", {
        importId,
        message: record.errorMessage,
      });
    }
  }

  getImportResult(importId: string): ResultSummary {
    const record = this.executions.get(importId);
    if (!record) {
      throw new NotFoundError(`No import found with id "${importId}".`, { importId });
    }

    if (!record.result) {
      return {
        importId,
        status: record.status,
        totalRows: record.parsedDataset.rowCount,
        importedCount: 0,
        skippedCount: 0,
        failedBatches: 0,
        durationMs: 0,
        needsReviewCount: 0,
        rejectedCount: 0,
        averageConfidence: null,
        averageQualityScore: null,
        progress: computeProgress(
          {
            startedAt: record.startedAt,
            currentStage: record.currentStage,
            currentBatchId: record.currentBatchId,
          },
          record.parsedDataset.rowCount,
          record.completedRecords,
        ),
        batches: [],
        errorMessage: record.errorMessage,
      };
    }

    const { result } = record;
    return {
      importId,
      status: record.status,
      totalRows: record.parsedDataset.rowCount,
      importedCount: result.approvedRecords.length,
      skippedCount: result.skippedRecords.length,
      failedBatches: result.failedBatches.length,
      durationMs: result.durationMs,
      needsReviewCount: result.needsReviewRecords.length,
      rejectedCount: result.rejectedRecords.length,
      averageConfidence: result.datasetSummary?.averageConfidence ?? null,
      averageQualityScore: result.datasetSummary?.averageQualityScore ?? null,
      progress: null,
      batches: result.allBatches.map((batch): BatchSummaryDTO => ({
        batchId: batch.batchId,
        sequenceNumber: batch.sequenceNumber,
        status: toBatchStatus(batch.status),
        recordCount: batch.statistics.recordCount ?? 0,
        durationMs: batch.timing.durationMs,
      })),
      errorMessage: record.errorMessage,
    };
  }
}
