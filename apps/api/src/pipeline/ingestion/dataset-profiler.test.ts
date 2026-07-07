import { describe, expect, it } from "vitest";
import type { StageExecutionInfo } from "@/pipeline/contracts/stage-result";
import type { ParsedDataset, ParsedRow } from "@/pipeline/domain/parsing";
import type { UploadedFile } from "@/pipeline/domain/upload";
import { buildColumnProfiles } from "@/pipeline/ingestion/column-profiler";
import { buildDatasetMetadata } from "@/pipeline/ingestion/dataset-profiler";
import { buildHeaderProfiles } from "@/pipeline/ingestion/header-engine";

function toUploadedFile(sizeBytes: number): UploadedFile {
  return {
    uploadId: "u1",
    fileName: "t.csv",
    mimeType: "text/csv",
    sizeBytes,
    content: "x".repeat(sizeBytes),
    receivedAt: new Date().toISOString(),
  };
}

function toStageInfo(blankRowsSkipped: number): StageExecutionInfo {
  return {
    stageName: "csv-parsing",
    outcome: "success",
    timing: { startedAt: "", completedAt: "", durationMs: 0 },
    metadata: { blankRowsSkipped },
    warnings: [],
    errors: [],
  };
}

function row(
  rowNumber: number,
  cells: readonly string[],
  status: ParsedRow["status"] = "ok",
): ParsedRow {
  return { rowNumber, rawCells: cells, cells, status, warnings: [], context: {} };
}

describe("buildDatasetMetadata", () => {
  it("scores a perfectly clean dataset at 100", () => {
    const headers = ["A", "B", "C"];
    const rows = [row(1, ["1", "2", "3"]), row(2, ["4", "5", "6"])];
    const dataset: ParsedDataset = {
      headers,
      rows,
      delimiter: ",",
      encoding: "UTF-8",
      rowCount: rows.length,
      columnCount: headers.length,
      headerDuplicateFlags: [false, false, false],
    };
    const headerProfiles = buildHeaderProfiles(headers, dataset.headerDuplicateFlags);
    const columnProfiles = buildColumnProfiles(dataset, headerProfiles);

    const metadata = buildDatasetMetadata(
      dataset,
      toUploadedFile(100),
      toStageInfo(0),
      headerProfiles,
      columnProfiles,
    );

    expect(metadata.dataQualityScore).toBe(100);
    expect(metadata.malformedRowCount).toBe(0);
    expect(metadata.blankRowCount).toBe(0);
    expect(metadata.missingCellCount).toBe(0);
    expect(metadata.duplicateHeaderCount).toBe(0);
  });

  it("computes the exact hand-derived score for a dataset with known malformed/blank/missing/duplicate counts", () => {
    const headers = ["A", "B", "C"];
    // 4 data rows, 1 malformed ("recovered"), 3 missing cells spread across columns.
    const rows = [
      row(1, ["1", "2", "3"]),
      row(2, ["4", "", "6"]),
      row(3, ["7", "8", ""], "recovered"),
      row(4, ["", "11", "12"]),
    ];
    const dataset: ParsedDataset = {
      headers,
      rows,
      delimiter: ",",
      encoding: "UTF-8",
      rowCount: rows.length,
      columnCount: headers.length,
      headerDuplicateFlags: [true, true, false], // 2 of 3 columns are duplicates
    };
    const headerProfiles = buildHeaderProfiles(headers, dataset.headerDuplicateFlags);
    const columnProfiles = buildColumnProfiles(dataset, headerProfiles);

    const metadata = buildDatasetMetadata(
      dataset,
      toUploadedFile(500),
      toStageInfo(1), // 1 blank row skipped during parsing
      headerProfiles,
      columnProfiles,
    );

    expect(metadata.totalRows).toBe(4);
    expect(metadata.totalColumns).toBe(3);
    expect(metadata.malformedRowCount).toBe(1);
    expect(metadata.blankRowCount).toBe(1);
    expect(metadata.missingCellCount).toBe(3);
    expect(metadata.duplicateHeaderCount).toBe(2);
    // penalty = 0.25*40 + 0.2*10 + 0.25*30 + (2/3)*20 = 10 + 2 + 7.5 + 13.3333... = 32.8333...
    // score = round(100 - 32.8333...) = 67
    expect(metadata.dataQualityScore).toBe(67);
  });

  it("reports datasetSizeBytes and estimatedMemoryUsageBytes from the uploaded file", () => {
    const headers = ["A"];
    const rows = [row(1, ["1"])];
    const dataset: ParsedDataset = {
      headers,
      rows,
      delimiter: ",",
      encoding: "UTF-8",
      rowCount: rows.length,
      columnCount: headers.length,
      headerDuplicateFlags: [false],
    };
    const headerProfiles = buildHeaderProfiles(headers, dataset.headerDuplicateFlags);
    const columnProfiles = buildColumnProfiles(dataset, headerProfiles);

    const metadata = buildDatasetMetadata(
      dataset,
      toUploadedFile(1000),
      toStageInfo(0),
      headerProfiles,
      columnProfiles,
    );

    expect(metadata.datasetSizeBytes).toBe(1000);
    expect(metadata.estimatedMemoryUsageBytes).toBe(3000);
  });

  it.each([
    [100, 1, "low"], // well within the low range
    [10_000, 1, "low"], // exactly at the low/medium boundary -> low
    [10_001, 1, "medium"], // just past it -> medium
    [200_000, 1, "medium"], // exactly at the medium/high boundary -> medium
    [200_001, 1, "high"], // just past it -> high
  ])(
    "classifies %i total cells with %i column as '%s' complexity",
    (totalCells, totalColumns, expected) => {
      const totalRows = totalCells / totalColumns;
      const headers = Array.from({ length: totalColumns }, (_, i) => `Col${i}`);
      const rows = Array.from({ length: totalRows }, (_, i) =>
        row(
          i + 1,
          Array.from({ length: totalColumns }, () => "x"),
        ),
      );
      const dataset: ParsedDataset = {
        headers,
        rows,
        delimiter: ",",
        encoding: "UTF-8",
        rowCount: rows.length,
        columnCount: headers.length,
        headerDuplicateFlags: headers.map(() => false),
      };
      const headerProfiles = buildHeaderProfiles(headers, dataset.headerDuplicateFlags);
      const columnProfiles = buildColumnProfiles(dataset, headerProfiles);

      const metadata = buildDatasetMetadata(
        dataset,
        toUploadedFile(10),
        toStageInfo(0),
        headerProfiles,
        columnProfiles,
      );

      expect(metadata.estimatedComplexity).toBe(expected);
    },
  );
});
