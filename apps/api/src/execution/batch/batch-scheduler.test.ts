import { describe, expect, it } from "vitest";
import { scheduleBatches } from "@/execution/batch/batch-scheduler";
import { ConfigurationError } from "@/core/errors";
import { DEFAULT_EXECUTION_CONFIG } from "@/execution/config/execution-config";
import type { ParsedDataset, ParsedRow } from "@/pipeline/domain/parsing";

function row(rowNumber: number): ParsedRow {
  return {
    rowNumber,
    rawCells: [`v${rowNumber}`],
    cells: [`v${rowNumber}`],
    status: "ok",
    warnings: [],
    context: {},
  };
}

function dataset(rowCount: number): ParsedDataset {
  const rows = Array.from({ length: rowCount }, (_, i) => row(i + 1));
  return {
    headers: ["Column"],
    rows,
    delimiter: ",",
    encoding: "utf-8",
    rowCount,
    columnCount: 1,
    headerDuplicateFlags: [false],
  };
}

describe("scheduleBatches", () => {
  it("returns zero batches for an empty dataset", () => {
    const batches = scheduleBatches(dataset(0), "import-1");
    expect(batches).toEqual([]);
  });

  it("splits rows into batches of the configured size", () => {
    const batches = scheduleBatches(dataset(55), "import-1", {
      ...DEFAULT_EXECUTION_CONFIG,
      batchSize: 25,
    });
    expect(batches).toHaveLength(3);
    expect(batches[0].recordCount).toBe(25);
    expect(batches[1].recordCount).toBe(25);
    expect(batches[2].recordCount).toBe(5);
  });

  it("assigns 1-based, gap-free sequence numbers", () => {
    const batches = scheduleBatches(dataset(30), "import-1", {
      ...DEFAULT_EXECUTION_CONFIG,
      batchSize: 10,
    });
    expect(batches.map((b) => b.sequenceNumber)).toEqual([1, 2, 3]);
  });

  it("generates unique, importId-scoped batch IDs", () => {
    const batches = scheduleBatches(dataset(20), "import-42", {
      ...DEFAULT_EXECUTION_CONFIG,
      batchSize: 10,
    });
    expect(batches.map((b) => b.batchId)).toEqual(["import-42-batch-1", "import-42-batch-2"]);
  });

  it("preserves row order across batches", () => {
    const batches = scheduleBatches(dataset(10), "import-1", {
      ...DEFAULT_EXECUTION_CONFIG,
      batchSize: 4,
    });
    const allRowNumbers = batches.flatMap((b) => b.parsedDataset.rows.map((r) => r.rowNumber));
    expect(allRowNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("carries the source dataset's headers/delimiter/encoding onto every batch", () => {
    const source = dataset(5);
    const batches = scheduleBatches(source, "import-1", {
      ...DEFAULT_EXECUTION_CONFIG,
      batchSize: 2,
    });
    for (const batch of batches) {
      expect(batch.parsedDataset.headers).toEqual(source.headers);
      expect(batch.parsedDataset.delimiter).toBe(source.delimiter);
      expect(batch.parsedDataset.encoding).toBe(source.encoding);
    }
  });

  it("produces exactly one batch when batchSize exceeds the row count", () => {
    const batches = scheduleBatches(dataset(5), "import-1", {
      ...DEFAULT_EXECUTION_CONFIG,
      batchSize: 1000,
    });
    expect(batches).toHaveLength(1);
    expect(batches[0].recordCount).toBe(5);
  });

  it("has no inter-batch dependencies today", () => {
    const batches = scheduleBatches(dataset(10), "import-1", {
      ...DEFAULT_EXECUTION_CONFIG,
      batchSize: 5,
    });
    expect(batches.every((b) => b.dependsOn.length === 0)).toBe(true);
  });

  it("throws ConfigurationError for a non-positive batch size", () => {
    expect(() =>
      scheduleBatches(dataset(10), "import-1", { ...DEFAULT_EXECUTION_CONFIG, batchSize: 0 }),
    ).toThrow(ConfigurationError);
  });
});
