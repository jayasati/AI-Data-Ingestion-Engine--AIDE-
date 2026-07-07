import type { StageIssue } from "@/pipeline/contracts/stage-result";
import type { ParsedDataset, ParsedRow } from "@/pipeline/domain/parsing";
import type { ColumnProfile } from "@/pipeline/ingestion/column-profiler";
import type { DatasetIntelligence } from "@/pipeline/ingestion/dataset-intelligence";
import type { DatasetMetadata } from "@/pipeline/ingestion/dataset-profiler";
import type { HeaderProfile } from "@/pipeline/ingestion/header-engine";

export interface PreviewOptions {
  readonly maxRows: number;
}

export const DEFAULT_PREVIEW_OPTIONS: PreviewOptions = { maxRows: 50 };

export interface DatasetPreview {
  readonly previewRowCount: number;
  readonly totalRowCount: number;
  readonly headers: readonly HeaderProfile[];
  readonly rows: readonly ParsedRow[];
  readonly datasetMetadata: DatasetMetadata;
  readonly columnProfiles: readonly ColumnProfile[];
  readonly datasetIntelligence: DatasetIntelligence;
  readonly warnings: readonly StageIssue[];
}

/**
 * Slices the already-parsed dataset down to a preview-sized window and
 * assembles everything the frontend needs in one payload. Does no analysis
 * itself — every input is already computed by the header engine, column
 * profiler, and dataset profiler, so this stays a pure, cheap composition step.
 */
export function generatePreview(
  dataset: ParsedDataset,
  datasetMetadata: DatasetMetadata,
  headerProfiles: readonly HeaderProfile[],
  columnProfiles: readonly ColumnProfile[],
  datasetIntelligence: DatasetIntelligence,
  parserWarnings: readonly StageIssue[],
  options: PreviewOptions = DEFAULT_PREVIEW_OPTIONS,
): DatasetPreview {
  const rows = dataset.rows.slice(0, Math.max(0, options.maxRows));

  return {
    previewRowCount: rows.length,
    totalRowCount: dataset.rowCount,
    headers: headerProfiles,
    rows,
    datasetMetadata,
    columnProfiles,
    datasetIntelligence,
    warnings: parserWarnings,
  };
}
