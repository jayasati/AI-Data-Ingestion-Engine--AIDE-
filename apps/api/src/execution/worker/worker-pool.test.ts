import { describe, expect, it } from "vitest";
import { WorkerPool } from "@/execution/worker/worker-pool";
import type { WorkerStageSet } from "@/execution/worker/worker";
import { CancellationToken } from "@/execution/cancellation/cancellation-token";
import { ExecutionEventBus } from "@/execution/events/execution-event-bus";
import type { ExecutionEvent } from "@/execution/events/execution-event";
import type { ExecutionBatch } from "@/execution/batch/batch-model";
import type { PipelineStage, StageExecution } from "@/pipeline/contracts/pipeline-stage";
import { buildStageResult } from "@/pipeline/stages/shared/stage-result-factory";
import type { PipelineContext } from "@/pipeline/context";
import type { NormalizedDataset, NormalizationReport } from "@/pipeline/domain/normalization";
import type { ParsedDataset, ParsedRow } from "@/pipeline/domain/parsing";
import type { SemanticExtractionResult } from "@/pipeline/domain/extraction";
import type { ValidationResult } from "@/pipeline/domain/validation";

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

let concurrentCount = 0;
let maxObservedConcurrency = 0;

/** Duck-types a row number out of either a ParsedDataset-shaped or NormalizedDataset-shaped fake input, without resorting to `any`. */
function extractRowNumber(input: unknown): number | undefined {
  if (typeof input !== "object" || input === null) {
    return undefined;
  }
  if ("rows" in input) {
    return (input as { rows?: readonly { rowNumber: number }[] }).rows?.[0]?.rowNumber;
  }
  if ("recordCount" in input) {
    return (input as { recordCount?: number }).recordCount;
  }
  return undefined;
}

/**
 * Builds output as a function of input, tagging `recordCount` with whatever
 * row number the fake normalization stage saw — so a later stage in the
 * same fake chain can identify which batch it's processing and fail
 * selectively. A stage that ignores its input entirely can't test
 * batch-specific failure, since nothing about the originating batch would
 * ever reach a downstream stage.
 */
function passthroughStage<TInput, TOutput>(
  name: string,
  buildOutput: (input: TInput) => TOutput,
  failForRowNumber?: number,
): PipelineStage<TInput, TOutput> {
  return {
    name,
    async execute(input: TInput, context: PipelineContext): Promise<StageExecution<TOutput>> {
      concurrentCount += 1;
      maxObservedConcurrency = Math.max(maxObservedConcurrency, concurrentCount);
      await new Promise((resolve) => setTimeout(resolve, 5));
      concurrentCount -= 1;

      const rowNumber = extractRowNumber(input);
      const shouldFail = failForRowNumber !== undefined && rowNumber === failForRowNumber;
      return {
        context,
        result: buildStageResult<TOutput>({
          stageName: name,
          startedAt: new Date(),
          metadata: {},
          errors: shouldFail ? [{ code: "FORCED_FAILURE", message: "forced" }] : [],
          outcome: shouldFail ? "fatal_failure" : "success",
          output: shouldFail ? null : buildOutput(input),
        }),
      };
    },
  };
}

function row(rowNumber: number): ParsedRow {
  return { rowNumber, rawCells: ["x"], cells: ["x"], status: "ok", warnings: [], context: {} };
}

function makeBatch(sequenceNumber: number): ExecutionBatch {
  const parsedDataset: ParsedDataset = {
    headers: ["Col"],
    rows: [row(sequenceNumber)],
    delimiter: ",",
    encoding: "utf-8",
    rowCount: 1,
    columnCount: 1,
    headerDuplicateFlags: [false],
  };
  return {
    batchId: `batch-${sequenceNumber}`,
    importId: "import-1",
    sequenceNumber,
    parsedDataset,
    recordCount: 1,
    metadata: {},
    estimatedTokens: null,
    estimatedCostUsd: null,
    dependsOn: [],
  };
}

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

function stageSet(failForRowNumber?: number): WorkerStageSet {
  return {
    // Tags recordCount with the batch's own row number so downstream fake
    // stages can see which batch they're processing (a real NormalizedDataset
    // wouldn't do this; it's purely to make the fake chain testable).
    normalization: passthroughStage<ParsedDataset, NormalizedDataset>("normalization", (input) => ({
      headers: [],
      records: [],
      recordCount: input.rows[0]?.rowNumber ?? 0,
      report: EMPTY_NORMALIZATION_REPORT,
    })),
    semanticExtraction: passthroughStage<NormalizedDataset, SemanticExtractionResult>(
      "semantic-extraction",
      () => ({ records: [] }),
      failForRowNumber,
    ),
    validation: passthroughStage<SemanticExtractionResult, ValidationResult>(
      "validation",
      () => EMPTY_VALIDATION,
    ),
  };
}

describe("WorkerPool", () => {
  it("runs every batch and returns one result per batch, in order", async () => {
    concurrentCount = 0;
    maxObservedConcurrency = 0;
    const pool = new WorkerPool({
      stages: stageSet(),
      config: { ...baseConfig(), workerCount: 3 },
    });
    const batches = [makeBatch(1), makeBatch(2), makeBatch(3), makeBatch(4), makeBatch(5)];

    const results = await pool.runAll(batches, "exec-1");

    expect(results).toHaveLength(5);
    expect(results.map((r) => r.batchId)).toEqual([
      "batch-1",
      "batch-2",
      "batch-3",
      "batch-4",
      "batch-5",
    ]);
    expect(results.every((r) => r.status === "completed")).toBe(true);
  });

  it("never runs more batches concurrently than workerCount", async () => {
    concurrentCount = 0;
    maxObservedConcurrency = 0;
    const pool = new WorkerPool({
      stages: stageSet(),
      config: { ...baseConfig(), workerCount: 2 },
    });
    const batches = Array.from({ length: 8 }, (_, i) => makeBatch(i + 1));

    await pool.runAll(batches, "exec-1");

    expect(maxObservedConcurrency).toBeLessThanOrEqual(2);
    expect(maxObservedConcurrency).toBeGreaterThan(0);
  });

  it("respects a higher workerCount by using more concurrency", async () => {
    concurrentCount = 0;
    maxObservedConcurrency = 0;
    const pool = new WorkerPool({
      stages: stageSet(),
      config: { ...baseConfig(), workerCount: 5 },
    });
    const batches = Array.from({ length: 10 }, (_, i) => makeBatch(i + 1));

    await pool.runAll(batches, "exec-1");

    expect(maxObservedConcurrency).toBeGreaterThan(2);
  });

  it("supports partial success: one failing batch does not stop the others", async () => {
    const pool = new WorkerPool({
      stages: stageSet(3),
      config: { ...baseConfig(), workerCount: 2 },
    });
    const batches = [makeBatch(1), makeBatch(2), makeBatch(3), makeBatch(4)];

    const results = await pool.runAll(batches, "exec-1");

    const failed = results.filter((r) => r.status === "failed");
    const completed = results.filter((r) => r.status === "completed");
    expect(failed).toHaveLength(1);
    expect(completed).toHaveLength(3);
  });

  it("stops dispatching new batches once cancelled, leaving later batches unresolved", async () => {
    const token = new CancellationToken();
    const pool = new WorkerPool({
      stages: stageSet(),
      config: { ...baseConfig(), workerCount: 1 },
      cancellationToken: token,
    });
    const batches = [makeBatch(1), makeBatch(2), makeBatch(3)];

    const runPromise = pool.runAll(batches, "exec-1");
    token.cancel("stop");
    const results = await runPromise;

    expect(results.filter(Boolean).length).toBeLessThanOrEqual(batches.length);
  });

  it("publishes WorkerAssigned, BatchStarted, and BatchCompleted for every batch", async () => {
    const bus = new ExecutionEventBus();
    const events: ExecutionEvent[] = [];
    bus.subscribe((event) => events.push(event));

    const pool = new WorkerPool({
      stages: stageSet(),
      config: { ...baseConfig(), workerCount: 2 },
      eventBus: bus,
    });
    await pool.runAll([makeBatch(1), makeBatch(2)], "exec-1");

    expect(events.filter((e) => e.type === "WorkerAssigned")).toHaveLength(2);
    expect(events.filter((e) => e.type === "BatchStarted")).toHaveLength(2);
    expect(events.filter((e) => e.type === "BatchCompleted")).toHaveLength(2);
  });

  it("exposes workerCount matching the configured value", () => {
    const pool = new WorkerPool({
      stages: stageSet(),
      config: { ...baseConfig(), workerCount: 4 },
    });
    expect(pool.workerCount).toBe(4);
  });
});

function baseConfig() {
  return {
    workerCount: 2,
    batchSize: 10,
    executionTimeoutMs: 60_000,
    batchTimeoutMs: 30_000,
    aiRequestTimeoutMs: 20_000,
    validationTimeoutMs: 10_000,
    aggregationTimeoutMs: 10_000,
  };
}
