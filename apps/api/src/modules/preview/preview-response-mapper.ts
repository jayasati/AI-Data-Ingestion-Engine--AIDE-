import type {
  ColumnHintDTO,
  ColumnProfileDTO,
  DatasetIntelligenceDTO,
  DatasetMetadataDTO,
  DatasetPreviewResponse,
  HeaderProfileDTO,
  PreviewIssue,
  PreviewRowDTO,
} from "@aide/shared-types";
import type { DatasetPreview } from "@/pipeline";

/**
 * Translates the internal pipeline's `DatasetPreview` into the wire-contract
 * DTOs published by `@aide/shared-types`, so the frontend never depends on
 * apps/api's internal module structure.
 */
export function toPreviewResponse(preview: DatasetPreview): DatasetPreviewResponse {
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
