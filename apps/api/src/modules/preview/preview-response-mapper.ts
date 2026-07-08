import type {
  ColumnHintDTO,
  ColumnProfileDTO,
  DatasetIntelligenceDTO,
  DatasetMetadataDTO,
  DatasetPreviewResponse,
  HeaderProfileDTO,
  NormalizationFieldIssueDTO,
  NormalizationReportDTO,
  NormalizationSummaryDTO,
  PreviewIssue,
  PreviewRowDTO,
} from "@aide/shared-types";
import type { DatasetPreview, NormalizationSummary } from "@/pipeline";
import type { StageIssue } from "@/pipeline/contracts/stage-result";
import type { PreviewResult } from "@/modules/preview/preview.service";

/**
 * Translates the internal pipeline's `PreviewResult` (CSV Ingestion Engine
 * analysis + Normalization Engine summary) into the wire-contract DTOs
 * published by `@aide/shared-types`, so the frontend never depends on
 * apps/api's internal module structure.
 */
export function toPreviewResponse(result: PreviewResult): DatasetPreviewResponse {
  const { preview } = result;
  return {
    implemented: true,
    previewRowCount: preview.previewRowCount,
    totalRowCount: preview.totalRowCount,
    headers: preview.headers.map(toHeaderProfileDTO),
    rows: preview.rows.map(toPreviewRowDTO),
    datasetMetadata: toDatasetMetadataDTO(preview.datasetMetadata),
    columnProfiles: preview.columnProfiles.map(toColumnProfileDTO),
    datasetIntelligence: toDatasetIntelligenceDTO(preview.datasetIntelligence),
    warnings: preview.warnings.map(toIssue),
    normalization: toNormalizationSummaryDTO(result.normalization, result.normalizationWarnings),
  };
}

function toIssue(issue: { code: string; message: string }): PreviewIssue {
  return { code: issue.code, message: issue.message };
}

function toHeaderProfileDTO(header: DatasetPreview["headers"][number]): HeaderProfileDTO {
  return {
    columnIndex: header.columnIndex,
    originalHeader: header.originalHeader,
    normalizedHeader: header.normalizedHeader,
    isDuplicate: header.isDuplicate,
  };
}

function toPreviewRowDTO(row: DatasetPreview["rows"][number]): PreviewRowDTO {
  return {
    rowNumber: row.rowNumber,
    cells: row.cells,
    status: row.status,
    warnings: row.warnings.map(toIssue),
  };
}

function toDatasetMetadataDTO(metadata: DatasetPreview["datasetMetadata"]): DatasetMetadataDTO {
  return { ...metadata };
}

function toColumnProfileDTO(profile: DatasetPreview["columnProfiles"][number]): ColumnProfileDTO {
  return { ...profile };
}

function toDatasetIntelligenceDTO(
  intelligence: DatasetPreview["datasetIntelligence"],
): DatasetIntelligenceDTO {
  return {
    likelyEmailColumns: intelligence.likelyEmailColumns.map(toColumnHintDTO),
    likelyPhoneColumns: intelligence.likelyPhoneColumns.map(toColumnHintDTO),
    likelyDateColumns: intelligence.likelyDateColumns.map(toColumnHintDTO),
    likelyNumericColumns: intelligence.likelyNumericColumns.map(toColumnHintDTO),
    likelyTextColumns: intelligence.likelyTextColumns.map(toColumnHintDTO),
  };
}

function toColumnHintDTO(hint: ColumnHintDTO): ColumnHintDTO {
  return { ...hint };
}

function toNormalizationReportDTO(report: NormalizationSummary["report"]): NormalizationReportDTO {
  return { ...report };
}

function toNormalizationFieldIssueDTO(
  issue: NormalizationSummary["fieldIssues"][number],
): NormalizationFieldIssueDTO {
  return { ...issue };
}

function toNormalizationSummaryDTO(
  summary: NormalizationSummary,
  warnings: readonly StageIssue[],
): NormalizationSummaryDTO {
  return {
    report: toNormalizationReportDTO(summary.report),
    healthScore: summary.healthScore,
    fieldIssues: summary.fieldIssues.map(toNormalizationFieldIssueDTO),
    totalIssueCount: summary.totalIssueCount,
    warnings: warnings.map(toIssue),
  };
}
