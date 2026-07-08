import { describe, expect, it } from "vitest";
import { Worker, type WorkerStageSet } from "@/execution/worker/worker";
import type { ExecutionBatch } from "@/execution/batch/batch-model";
import type { PipelineStage, StageExecution } from "@/pipeline/contracts/pipeline-stage";
import type { StageResult } from "@/pipeline/contracts/stage-result";
import { buildStageResult } from "@/pipeline/stages/shared/stage-result-factory";
import type { PipelineContext } from "@/pipeline/context";
import type { NormalizedDataset, NormalizationReport } from "@/pipeline/domain/normalization";
import type { ParsedDataset, ParsedRow } from "@/pipeline/domain/parsing";
import type { SemanticExtractionResult } from "@/pipeline/domain/extraction";
import type { ValidationResult } from "@/pipeline/domain/validation";

const EMPTY_NORMALIZATION_REPORT: NormalizationReport = {
  totalFields: 0,
  whitespaceNormalizedCount: 0,
  unicodeNormalizedCount: 0,
  nullValuesDetected: 0,
  emailsNormalized: 0,
  invalidEmails: 0,
  phonesNormalized: 0,
  invalidPhones: 0,
  datesParsed: 0,
  failedDateParses: 0,
  numbersNormalized: 0,
  booleansNormalized: 0,
  fieldsWithWarnings: 0,
  fieldsFailed: 0,
};

const EMPTY_VALIDATION: ValidationResult = {
  records: [],
  summary: {
    totalRecords: 0,
    approvedCount: 0,
    needsReviewCount: 0,
    rejectedCount: 0,
    skippedCount: 0,
    averageConfidence: 0,
    averageQualityScore: 0,
    totalRepairs: 0,
    recordsWithRepairs: 0,
  },
};

function stubStage<TInput, TOutput>(
  stageName: string,
  outcome: "success" | "fatal_failure",
  output: TOutput | null,
): PipelineStage<TInput, TOutput> {
  return {
    name: stageName,
    async execute(_input: TInput, context: PipelineContext): Promise<StageExecution<TOutput>> {
      const result: StageResult<TOutput> = buildStageResult<TOutput>({
        stageName,
        startedAt: new Date(),
        metadata: {},
        errors:
          outcome === "fatal_failure" ? [{ code: "STUB_FAILED", message: "stub failed" }] : [],
        outcome,
        output,
      });
      return { context, result };
    },
  };
}

function row(rowNumber: number): ParsedRow {
  return { rowNumber, rawCells: ["x"], cells: ["x"], status: "ok", warnings: [], context: {} };
}

function batch(): ExecutionBatch {
  const parsedDataset: ParsedDataset = {
    headers: ["Col"],
    rows: [row(1)],
    delimiter: ",",
    encoding: "utf-8",
    rowCount: 1,
    columnCount: 1,
    headerDuplicateFlags: [false],
  };
  return {
    batchId: "batch-1",
    importId: "import-1",
    sequenceNumber: 1,
    parsedDataset,
    recordCount: 1,
    metadata: {},
    estimatedTokens: null,
    estimatedCostUsd: null,
    dependsOn: [],
  };
}

const NORMALIZED_DATASET: NormalizedDataset = {
  headers: ["Col"],
  records: [],
  recordCount: 0,
  report: EMPTY_NORMALIZATION_REPORT,
};

const EXTRACTION_RESULT: SemanticExtractionResult = { records: [] };

function stages(overrides: Partial<WorkerStageSet> = {}): WorkerStageSet {
  return {
    normalization: stubStage("normalization", "success", NORMALIZED_DATASET),
    semanticExtraction: stubStage("semantic-extraction", "success", EXTRACTION_RESULT),
    validation: stubStage("validation", "success", EMPTY_VALIDATION),
    ...overrides,
  };
}

describe("Worker", () => {
  it("returns status 'completed' when every stage succeeds", async () => {
    const worker = new Worker("worker-1", stages());
    const result = await worker.execute(batch());

    expect(result.status).toBe("completed");
    expect(result.validation).toBe(EMPTY_VALIDATION);
    expect(result.batchId).toBe("batch-1");
    expect(result.sequenceNumber).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("returns status 'failed' with null validation when normalization fails", async () => {
    const worker = new Worker(
      "worker-1",
      stages({ normalization: stubStage("normalization", "fatal_failure", null) }),
    );
    const result = await worker.execute(batch());

    expect(result.status).toBe("failed");
    expect(result.validation).toBeNull();
    expect(result.errors[0].code).toBe("STUB_FAILED");
  });

  it("returns status 'failed' when semantic extraction (AI) fails, carrying the normalization report", async () => {
    const worker = new Worker(
      "worker-1",
      stages({ semanticExtraction: stubStage("semantic-extraction", "fatal_failure", null) }),
    );
    const result = await worker.execute(batch());

    expect(result.status).toBe("failed");
    expect(result.normalizationReport).toBe(EMPTY_NORMALIZATION_REPORT);
  });

  it("returns status 'failed' when the Trust Layer (validation) stage fails", async () => {
    const worker = new Worker(
      "worker-1",
      stages({ validation: stubStage("validation", "fatal_failure", null) }),
    );
    const result = await worker.execute(batch());

    expect(result.status).toBe("failed");
    expect(result.validation).toBeNull();
  });

  it("records real timing (non-negative duration)", async () => {
    const worker = new Worker("worker-1", stages());
    const result = await worker.execute(batch());
    expect(result.timing.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.startedAt).toBeTruthy();
    expect(result.timing.completedAt).toBeTruthy();
  });

  it("carries the batch's record count into statistics", async () => {
    const worker = new Worker("worker-1", stages());
    const result = await worker.execute(batch());
    expect(result.statistics.recordCount).toBe(1);
  });
});
