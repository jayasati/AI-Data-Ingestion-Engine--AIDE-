import type { StageExecutionInfo } from "@/pipeline/contracts/stage-result";
import type { UploadedFile } from "@/pipeline/domain/upload";
import type { ParsedDataset } from "@/pipeline/domain/parsing";
import type { ColumnProfile } from "@/pipeline/ingestion/column-profiler";
import type { HeaderProfile } from "@/pipeline/ingestion/header-engine";

export type DatasetComplexity = "low" | "medium" | "high";

/**
 * Parse-time structural quality score (0-100). Distinct from the future
 * Validation & Trust Engine's confidence scoring — this measures how cleanly
 * the file parsed, not whether the data is semantically correct.
 */
export interface DatasetMetadata {
  readonly totalRows: number;
  readonly totalColumns: number;
  readonly duplicateHeaderCount: number;
  readonly delimiter: string;
  readonly encoding: string;
  readonly blankRowCount: number;
  readonly malformedRowCount: number;
  readonly missingCellCount: number;
  readonly estimatedComplexity: DatasetComplexity;
  readonly datasetSizeBytes: number;
  readonly estimatedMemoryUsageBytes: number;
  readonly dataQualityScore: number;
}

const COMPLEXITY_CELL_THRESHOLDS = { low: 10_000, medium: 200_000 };
/** Rough heuristic: decoded JS string is 2 bytes/char, plus per-cell/array/object overhead. */
const ESTIMATED_MEMORY_MULTIPLIER = 3;

const QUALITY_PENALTY_WEIGHTS = {
  malformedRowRatio: 40,
  blankRowRatio: 10,
  missingCellRatio: 30,
  duplicateHeaderRatio: 20,
};

export function buildDatasetMetadata(
  dataset: ParsedDataset,
  uploadedFile: UploadedFile,
  parserStageInfo: StageExecutionInfo,
  headerProfiles: readonly HeaderProfile[],
  columnProfiles: readonly ColumnProfile[],
): DatasetMetadata {
  const totalRows = dataset.rowCount;
  const totalColumns = dataset.columnCount;
  const duplicateHeaderCount = headerProfiles.filter((header) => header.isDuplicate).length;
  const blankRowCount = readNumberMetadata(parserStageInfo, "blankRowsSkipped");
  const malformedRowCount = dataset.rows.filter((row) => row.status === "recovered").length;
  const missingCellCount = columnProfiles.reduce(
    (sum, column) => sum + column.missingValueCount,
    0,
  );

  const totalCells = totalRows * totalColumns;
  const estimatedComplexity: DatasetComplexity =
    totalCells <= COMPLEXITY_CELL_THRESHOLDS.low
      ? "low"
      : totalCells <= COMPLEXITY_CELL_THRESHOLDS.medium
        ? "medium"
        : "high";

  const dataQualityScore = computeDataQualityScore({
    totalRows,
    totalColumns,
    duplicateHeaderCount,
    blankRowCount,
    malformedRowCount,
    missingCellCount,
  });

  return {
    totalRows,
    totalColumns,
    duplicateHeaderCount,
    delimiter: dataset.delimiter,
    encoding: dataset.encoding,
    blankRowCount,
    malformedRowCount,
    missingCellCount,
    estimatedComplexity,
    datasetSizeBytes: uploadedFile.sizeBytes,
    estimatedMemoryUsageBytes: uploadedFile.sizeBytes * ESTIMATED_MEMORY_MULTIPLIER,
    dataQualityScore,
  };
}

function computeDataQualityScore(counts: {
  totalRows: number;
  totalColumns: number;
  duplicateHeaderCount: number;
  blankRowCount: number;
  malformedRowCount: number;
  missingCellCount: number;
}): number {
  const totalRowAttempts = counts.totalRows + counts.blankRowCount;
  const totalCells = counts.totalRows * counts.totalColumns;

  const malformedRowRatio = counts.totalRows > 0 ? counts.malformedRowCount / counts.totalRows : 0;
  const blankRowRatio = totalRowAttempts > 0 ? counts.blankRowCount / totalRowAttempts : 0;
  const missingCellRatio = totalCells > 0 ? counts.missingCellCount / totalCells : 0;
  const duplicateHeaderRatio =
    counts.totalColumns > 0 ? counts.duplicateHeaderCount / counts.totalColumns : 0;

  const penalty =
    malformedRowRatio * QUALITY_PENALTY_WEIGHTS.malformedRowRatio +
    blankRowRatio * QUALITY_PENALTY_WEIGHTS.blankRowRatio +
    missingCellRatio * QUALITY_PENALTY_WEIGHTS.missingCellRatio +
    duplicateHeaderRatio * QUALITY_PENALTY_WEIGHTS.duplicateHeaderRatio;

  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

function readNumberMetadata(info: StageExecutionInfo, key: string): number {
  const value = info.metadata[key];
  return typeof value === "number" ? value : 0;
}
