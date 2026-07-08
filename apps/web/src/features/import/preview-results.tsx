import type { ReactNode } from "react";
import type { ColumnProfileDTO, DatasetPreviewResponse, PreviewRowDTO } from "@aide/shared-types";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, type TableColumn } from "@/components/ui/table";
import { NormalizationSummary } from "@/features/import/normalization-summary";
import { SemanticSummary } from "@/features/import/semantic-summary";

const DELIMITER_LABELS: Record<string, string> = {
  ",": "Comma",
  ";": "Semicolon",
  "\t": "Tab",
  "|": "Pipe",
};

const COMPLEXITY_VARIANT: Record<
  DatasetPreviewResponse["datasetMetadata"]["estimatedComplexity"],
  BadgeVariant
> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

const DATA_TYPE_VARIANT: Record<ColumnProfileDTO["dataTypeGuess"], BadgeVariant> = {
  email: "accent",
  phone: "accent",
  date: "accent",
  numeric: "accent",
  text: "neutral",
  empty: "neutral",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function qualityScoreVariant(score: number): BadgeVariant {
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "danger";
}

function delimiterLabel(delimiter: string): string {
  return DELIMITER_LABELS[delimiter] ?? delimiter;
}

export function PreviewResults({ preview }: { preview: DatasetPreviewResponse }) {
  const {
    datasetMetadata,
    columnProfiles,
    warnings,
    headers,
    rows,
    previewRowCount,
    totalRowCount,
    normalization,
    semantics,
  } = preview;

  const tableColumns: TableColumn<PreviewRowDTO>[] = [
    {
      key: "__row",
      header: "#",
      className: "text-muted-foreground",
      render: (row) => (
        <span title={row.warnings.map((w) => w.message).join(" ") || undefined}>
          {row.rowNumber}
          {row.status === "recovered" ? (
            <span
              aria-label="Row was recovered from a formatting issue"
              className="ml-1 text-amber-500"
            >
              ●
            </span>
          ) : null}
        </span>
      ),
    },
    ...headers.map((header): TableColumn<PreviewRowDTO> => ({
      key: `col-${header.columnIndex}`,
      header: header.originalHeader,
      render: (row) => (
        <span className="block max-w-xs truncate" title={row.cells[header.columnIndex]}>
          {row.cells[header.columnIndex] || <span className="text-muted-foreground">—</span>}
        </span>
      ),
    })),
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dataset Summary</CardTitle>
          <CardDescription>
            Showing {previewRowCount} of {totalRowCount} row{totalRowCount === 1 ? "" : "s"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <SummaryStat label="Rows" value={String(datasetMetadata.totalRows)} />
            <SummaryStat label="Columns" value={String(datasetMetadata.totalColumns)} />
            <SummaryStat label="Delimiter" value={delimiterLabel(datasetMetadata.delimiter)} />
            <SummaryStat label="Encoding" value={datasetMetadata.encoding} />
            <SummaryStat label="File size" value={formatBytes(datasetMetadata.datasetSizeBytes)} />
            <SummaryStat
              label="Complexity"
              value={
                <Badge variant={COMPLEXITY_VARIANT[datasetMetadata.estimatedComplexity]}>
                  {datasetMetadata.estimatedComplexity}
                </Badge>
              }
            />
            <SummaryStat
              label="Quality score"
              value={
                <Badge variant={qualityScoreVariant(datasetMetadata.dataQualityScore)}>
                  {datasetMetadata.dataQualityScore}/100
                </Badge>
              }
            />
            <SummaryStat
              label="Duplicate headers"
              value={String(datasetMetadata.duplicateHeaderCount)}
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Columns</CardTitle>
          <CardDescription>
            Deterministic, AI-free hints — never a CRM field mapping.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {columnProfiles.map((column) => (
              <ColumnStatCard key={column.columnIndex} column={column} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            Parsed rows before any AI processing runs. <span className="text-amber-500">●</span>{" "}
            marks a row that was padded or truncated to fit the header.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table
            columns={tableColumns}
            rows={rows}
            rowKey={(row) => String(row.rowNumber)}
            caption="Parsed CSV preview"
          />
        </CardContent>
      </Card>

      <WarningsPanel warnings={warnings} />

      <SemanticSummary semantics={semantics} />

      <NormalizationSummary normalization={normalization} />
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  );
}

function ColumnStatCard({ column }: { column: ColumnProfileDTO }) {
  return (
    <div className="w-56 shrink-0 rounded-lg border border-border p-4">
      <p className="truncate font-medium" title={column.originalHeader}>
        {column.originalHeader}
      </p>
      <p className="truncate text-xs text-muted-foreground" title={column.normalizedHeader}>
        {column.normalizedHeader}
        {column.isDuplicateHeader ? " · duplicate" : ""}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Badge variant={DATA_TYPE_VARIANT[column.dataTypeGuess]}>{column.dataTypeGuess}</Badge>
        {column.confidenceScore > 0 ? (
          <span className="text-xs text-muted-foreground">
            {Math.round(column.confidenceScore * 100)}% confidence
          </span>
        ) : null}
      </div>
      <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <dt>Missing</dt>
          <dd>{column.nullPercentage.toFixed(0)}%</dd>
        </div>
        <div className="flex justify-between">
          <dt>Unique</dt>
          <dd>{column.uniqueValueCount}</dd>
        </div>
      </dl>
      {column.sampleValues.length > 0 ? (
        <div className="mt-3 space-y-1">
          {column.sampleValues.slice(0, 3).map((sample, index) => (
            <p
              key={index}
              title={sample}
              className="truncate rounded bg-surface-muted px-2 py-1 text-xs"
            >
              {sample}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WarningsPanel({ warnings }: { warnings: DatasetPreviewResponse["warnings"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Warnings</CardTitle>
        <CardDescription>Issues the parser recovered from automatically.</CardDescription>
      </CardHeader>
      <CardContent>
        {warnings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No warnings — the file parsed cleanly.</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {warnings.map((warning, index) => (
              <li
                key={index}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
              >
                {warning.message}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
