import type { ReactNode } from "react";
import type { ConfidenceTier, SemanticReportDTO } from "@aide/shared-types";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TIER_VARIANT: Record<ConfidenceTier, BadgeVariant> = {
  deterministic: "success",
  ai_candidate: "warning",
  ai_required: "accent",
  unknown: "neutral",
};

const TIER_LABEL: Record<ConfidenceTier, string> = {
  deterministic: "Mapped",
  ai_candidate: "AI-assisted",
  ai_required: "AI required",
  unknown: "Unknown",
};

function formatDatasetType(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatFieldName(fieldId: string): string {
  return fieldId
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/**
 * Deterministic, pre-AI field-mapping intelligence — never the internal
 * rule/confidence machinery that produced it. Shows what the engine already
 * understands about the dataset before any AI call happens.
 */
export function SemanticSummary({ semantics }: { semantics: SemanticReportDTO }) {
  const { columns } = semantics;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Semantic Intelligence</CardTitle>
        <CardDescription>
          Deterministic field-mapping analysis, computed before any AI call.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Detected dataset type</span>
          <Badge variant="accent">{formatDatasetType(semantics.datasetType)}</Badge>
          <span className="text-xs text-muted-foreground">
            {formatPercent(semantics.datasetTypeConfidence)} confidence
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <SummaryStat label="Columns analyzed" value={String(semantics.columnsAnalyzed)} />
          <SummaryStat
            label="Mapped without AI"
            value={<Badge variant="success">{semantics.highConfidenceCount}</Badge>}
          />
          <SummaryStat
            label="AI-assisted"
            value={<Badge variant="warning">{semantics.mediumConfidenceCount}</Badge>}
          />
          <SummaryStat
            label="AI required"
            value={<Badge variant="accent">{semantics.aiRequiredCount}</Badge>}
          />
          <SummaryStat
            label="Semantic coverage"
            value={formatPercent(semantics.semanticCoverage)}
          />
        </dl>

        <ColumnMappingList columns={columns} />
      </CardContent>
    </Card>
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

function ColumnMappingList({ columns }: { columns: SemanticReportDTO["columns"] }) {
  if (columns.length === 0) {
    return <p className="text-sm text-muted-foreground">No columns to analyze.</p>;
  }

  return (
    <div>
      <h3 className="text-sm font-medium">Likely field mappings</h3>
      <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto">
        {columns.map((column) => (
          <li
            key={column.columnIndex}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm"
          >
            <span className="font-medium">{column.header}</span>
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant={TIER_VARIANT[column.tier]}>{TIER_LABEL[column.tier]}</Badge>
              {column.topCandidateField ? (
                <span className="text-xs text-muted-foreground">
                  {formatFieldName(column.topCandidateField)} (
                  {formatPercent(column.topCandidateConfidence)})
                  {column.alternateCandidates.length > 0 ? (
                    <>
                      {" · also "}
                      {column.alternateCandidates
                        .map(
                          (alt) =>
                            `${formatFieldName(alt.fieldId)} (${formatPercent(alt.confidence)})`,
                        )
                        .join(", ")}
                    </>
                  ) : null}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">No confident match</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
