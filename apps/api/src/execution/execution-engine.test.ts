import { describe, expect, it } from "vitest";
import { ExecutionEngine } from "@/execution/execution-engine";
import { ExecutionState } from "@/execution/state/execution-state";
import { CancellationToken } from "@/execution/cancellation/cancellation-token";
import type { WorkerStageSet } from "@/execution/worker/worker";
import type { PipelineStage, StageExecution } from "@/pipeline/contracts/pipeline-stage";
import { buildStageResult } from "@/pipeline/stages/shared/stage-result-factory";
import type { PipelineContext } from "@/pipeline/context";
import type { NormalizedDataset, NormalizationReport } from "@/pipeline/domain/normalization";
import type { ParsedDataset, ParsedRow } from "@/pipeline/domain/parsing";
import type { SemanticExtractionResult } from "@/pipeline/domain/extraction";
import type { ApprovalStatus, ValidatedRecord } from "@/pipeline/domain/validation";

function row(rowNumber: number): ParsedRow {
  return { rowNumber, rawCells: ["x"], cells: ["x"], status: "ok", warnings: [], context: {} };
}

function dataset(rowCount: number): ParsedDataset {
  return {
    headers: ["Col"],
    rows: Array.from({ length: rowCount }, (_, i) => row(i + 1)),
    delimiter: ",",
    encoding: "utf-8",
    rowCount,
    columnCount: 1,
    headerDuplicateFlags: [false],
  };
}

function stubRecord(rowNumber: number, status: ApprovalStatus): ValidatedRecord {
  return {
    rowNumber,
    isValid: status !== "rejected",
    confidenceScore: 0.9,
    issues: [],
    approvalStatus: status,
    approvalReason: "",
    qualityScore: 80,
    skipped: status === "skipped",
    skipReason: null,
    repairCount: 0,
    repairsApplied: [],
    fields: [],
    classifiedIssues: [],
  };
}

function passthrough<TInput, TOutput>(
  name: string,
  buildOutput: (input: TInput) => TOutput,
): PipelineStage<TInput, TOutput> {
  return {
    name,
    async execute(input: TInput, context: PipelineContext): Promise<StageExecution<TOutput>> {
      return {
        context,
        result: buildStageResult<TOutput>({
          stageName: name,
          startedAt: new Date(),
          metadata: {},
          outcome: "success",
          output: buildOutput(input),
        }),
      };
    },
  };
}

function failingStage<TInput, TOutput>(name: string): PipelineStage<TInput, TOutput> {
  return {
    name,
    async execute(_input: TInput, context: PipelineContext): Promise<StageExecution<TOutput>> {
      return {
        context,
        result: buildStageResult<TOutput>({
          stageName: name,
          startedAt: new Date(),
          metadata: {},
          errors: [{ code: "FORCED_FAILURE", message: "forced" }],
          outcome: "fatal_failure",
          output: null,
        }),
      };
    },
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

/** Every batch approves its single record, except batches whose row is in `rejectRowNumbers`, which fail entirely. */
function stageSet(rejectRowNumbers: readonly number[] = []): WorkerStageSet {
  return {
    normalization: passthrough<ParsedDataset, NormalizedDataset>("normalization", (input) => ({
      headers: [],
      records: [],
      recordCount: input.rows[0]?.rowNumber ?? 0,
      report: EMPTY_NORMALIZATION_REPORT,
    })),
    semanticExtraction: {
      name: "semantic-extraction",
      async execute(
        input: NormalizedDataset,
        context: PipelineContext,
      ): Promise<StageExecution<SemanticExtractionResult>> {
        const rowNumber = input.recordCount;
        if (rejectRowNumbers.includes(rowNumber)) {
          return failingStage<NormalizedDataset, SemanticExtractionResult>(
            "semantic-extraction",
          ).execute(input, context);
        }
        return passthrough<NormalizedDataset, SemanticExtractionResult>(
          "semantic-extraction",
          () => ({ records: [{ rowNumber, fields: [] }] }),
        ).execute(input, context);
      },
    },
    validation: passthrough<SemanticExtractionResult, ReturnType<typeof buildValidation>>(
      "validation",
      (input) => buildValidation(input.records.map((r) => r.rowNumber)),
    ),
  };
}

function buildValidation(rowNumbers: readonly number[]) {
  const records = rowNumbers.map((rowNumber) => stubRecord(rowNumber, "approved"));
  return {
    records,
    summary: {
      totalRecords: records.length,
      approvedCount: records.length,
      needsReviewCount: 0,
      rejectedCount: 0,
      skippedCount: 0,
      averageConfidence: 0.9,
      averageQualityScore: 80,
      totalRepairs: 0,
      recordsWithRepairs: 0,
    },
  };
}

function baseConfig() {
  return {
    workerCount: 2,
    batchSize: 1,
    executionTimeoutMs: 60_000,
    batchTimeoutMs: 30_000,
    aiRequestTimeoutMs: 20_000,
    validationTimeoutMs: 10_000,
    aggregationTimeoutMs: 10_000,
  };
}

describe("ExecutionEngine.run", () => {
  it("completes successfully and approves every record when every batch succeeds", async () => {
    const engine = new ExecutionEngine();
    const { context, result } = await engine.run({
      importId: "import-1",
      parsedDataset: dataset(4),
      stages: stageSet(),
      config: baseConfig(),
    });

    expect(context.currentState).toBe(ExecutionState.Completed);
    expect(result.approvedRecords).toHaveLength(4);
    expect(result.succeededBatches).toBe(4);
    expect(result.failedBatches).toHaveLength(0);
  });

  it("stamps result.finalState with the terminal state, not the transient Aggregating snapshot", async () => {
    const engine = new ExecutionEngine();
    const { context, result } = await engine.run({
      importId: "import-1",
      parsedDataset: dataset(2),
      stages: stageSet(),
      config: baseConfig(),
    });

    // Regression: aggregateResults() must run AFTER the Completed transition,
    // not between Aggregating and Completed — otherwise result.finalState
    // (read by callers like ImportService) stays "AGGREGATING" forever,
    // even though the returned `context` itself correctly reads "COMPLETED".
    expect(result.finalState).toBe(ExecutionState.Completed);
    expect(result.finalState).toBe(context.currentState);
  });

  it("still completes overall when some batches fail, keeping every successful record (partial success)", async () => {
    const engine = new ExecutionEngine();
    const { context, result } = await engine.run({
      importId: "import-1",
      parsedDataset: dataset(4),
      stages: stageSet([2]),
      config: baseConfig(),
    });

    expect(context.currentState).toBe(ExecutionState.Completed);
    expect(result.approvedRecords).toHaveLength(3);
    expect(result.succeededBatches).toBe(3);
    expect(result.failedBatches).toHaveLength(1);
  });

  it("reaches ExecutionState.Cancelled and reconciles undispatched batches when cancelled up front", async () => {
    const token = new CancellationToken();
    token.cancel("stop before starting");
    const engine = new ExecutionEngine();

    const { context, result } = await engine.run({
      importId: "import-1",
      parsedDataset: dataset(3),
      stages: stageSet(),
      config: { ...baseConfig(), workerCount: 1 },
      cancellationToken: token,
    });

    expect(context.currentState).toBe(ExecutionState.Cancelled);
    expect(result.finalState).toBe(ExecutionState.Cancelled);
    expect(result.totalBatches).toBe(3);
    expect(result.failedBatches.every((b) => b.status === "cancelled")).toBe(true);
  });

  it("reaches ExecutionState.Failed and reports a usable ImportResult when scheduling itself throws", async () => {
    const engine = new ExecutionEngine();
    const { context, result } = await engine.run({
      importId: "import-1",
      parsedDataset: dataset(3),
      stages: stageSet(),
      config: { ...baseConfig(), batchSize: 0 },
    });

    expect(context.currentState).toBe(ExecutionState.Failed);
    expect(result.approvedRecords).toEqual([]);
    expect(result.finalState).toBe(ExecutionState.Failed);
  });

  it("produces a merged datasetSummary across every successful batch", async () => {
    const engine = new ExecutionEngine();
    const { result } = await engine.run({
      importId: "import-1",
      parsedDataset: dataset(3),
      stages: stageSet(),
      config: baseConfig(),
    });

    expect(result.datasetSummary?.totalRecords).toBe(3);
    expect(result.datasetSummary?.approvedCount).toBe(3);
  });

  it("computes non-negative metrics for a real run", async () => {
    const engine = new ExecutionEngine();
    const { result } = await engine.run({
      importId: "import-1",
      parsedDataset: dataset(2),
      stages: stageSet(),
      config: baseConfig(),
    });

    expect(result.metrics.totalRecords).toBe(2);
    expect(result.metrics.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("handles an empty dataset without error, completing with zero batches", async () => {
    const engine = new ExecutionEngine();
    const { context, result } = await engine.run({
      importId: "import-1",
      parsedDataset: dataset(0),
      stages: stageSet(),
      config: baseConfig(),
    });

    expect(context.currentState).toBe(ExecutionState.Completed);
    expect(result.totalBatches).toBe(0);
    expect(result.approvedRecords).toEqual([]);
  });
});
