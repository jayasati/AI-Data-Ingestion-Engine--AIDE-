import type { ReactNode } from "react";
import type {
  AIExecutionReportDTO,
  AIExtractResponse,
  ApprovalStatusDTO,
  DatasetValidationSummaryDTO,
  ExtractedRecordDTO,
  PromptExecutionMetadataDTO,
  ValidatedRecordDTO,
} from "@aide/shared-types";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, type TableColumn } from "@/components/ui/table";

const APPROVAL_VARIANT: Record<ApprovalStatusDTO, BadgeVariant> = {
  approved: "success",
  needs_review: "warning",
  rejected: "danger",
  skipped: "neutral",
};

const APPROVAL_LABEL: Record<ApprovalStatusDTO, string> = {
  approved: "Approved",
  needs_review: "Needs Review",
  rejected: "Rejected",
  skipped: "Skipped",
};

const STATUS_VARIANT: Record<AIExecutionReportDTO["status"], BadgeVariant> = {
  success: "success",
  parser_error: "danger",
  provider_error: "danger",
  timeout: "danger",
  compilation_error: "danger",
};

const STATUS_LABEL: Record<AIExecutionReportDTO["status"], string> = {
  success: "Success",
  parser_error: "Parser error",
  provider_error: "Provider error",
  timeout: "Timeout",
  compilation_error: "Prompt compilation error",
};

/** Title-cases a snake_case CRM field key, e.g. "mobile_without_country_code" -> "Mobile Without Country Code". */
function fieldLabel(field: string): string {
  return field
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatLatency(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
}

/**
 * Renders one AI extraction diagnostic run: provider/model/status, a capped
 * warnings list, and the extracted CRM-field records. Token usage and cost
 * are shown as secondary, small-print detail (not headline stats) since the
 * spec calls them out as optional. Never renders the compiled prompt or raw
 * provider response text — neither is present in `AIExtractResponse`.
 */
export function AIExtractionSummary({ result }: { result: AIExtractResponse }) {
  const { records, recordCount, report, validation } = result;

  const validationByRow = new Map(validation.records.map((record) => [record.rowNumber, record]));

  const fieldKeys = Array.from(
    new Set(records.flatMap((record) => record.fields.map((field) => field.targetField))),
  );

  const tableColumns: TableColumn<ExtractedRecordDTO>[] = [
    {
      key: "__row",
      header: "#",
      className: "text-muted-foreground",
      render: (record) => record.rowNumber,
    },
    {
      key: "__approval",
      header: "Status",
      render: (record) => {
        const verdict = validationByRow.get(record.rowNumber);
        return verdict ? (
          <Badge variant={APPROVAL_VARIANT[verdict.approvalStatus]}>
            {APPROVAL_LABEL[verdict.approvalStatus]}
          </Badge>
        ) : null;
      },
    },
    {
      key: "__quality",
      header: "Quality",
      className: "text-muted-foreground",
      render: (record) => validationByRow.get(record.rowNumber)?.qualityScore ?? "—",
    },
    ...fieldKeys.map((fieldKey): TableColumn<ExtractedRecordDTO> => {
      return {
        key: fieldKey,
        header: fieldLabel(fieldKey),
        render: (record) => {
          const field = record.fields.find((candidate) => candidate.targetField === fieldKey);
          const value = field?.value ?? null;
          return (
            <span className="block max-w-xs truncate" title={value ?? undefined}>
              {value || <span className="text-muted-foreground">—</span>}
            </span>
          );
        },
      };
    }),
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Extraction</CardTitle>
          <CardDescription>
            One diagnostic call to the AI Orchestration Platform — provider, model, and mapping
            result for this file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={STATUS_VARIANT[report.status]}>{STATUS_LABEL[report.status]}</Badge>
            <span className="text-sm text-muted-foreground">
              {report.provider} · {report.model}
            </span>
            <span className="text-xs text-muted-foreground">
              {recordCount} record{recordCount === 1 ? "" : "s"} extracted
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <SummaryStat label="Latency" value={formatLatency(report.latencyMs)} />
            <SummaryStat label="Prompt version" value={report.promptVersion} />
            <SummaryStat label="Schema version" value={report.schemaVersion} />
          </dl>

          <p className="text-xs text-muted-foreground">
            Tokens: {report.tokenUsage.totalTokens} ({report.tokenUsage.promptTokens} prompt +{" "}
            {report.tokenUsage.completionTokens} completion)
            {report.estimatedCostUsd !== null
              ? ` · est. $${report.estimatedCostUsd.toFixed(4)}`
              : ""}
          </p>
        </CardContent>
      </Card>

      <WarningsPanel warnings={report.warnings} />

      {report.promptMetadata ? <PromptExecutionPanel metadata={report.promptMetadata} /> : null}

      <DatasetHealthPanel summary={validation.summary} />

      <Card>
        <CardHeader>
          <CardTitle>Extracted Records</CardTitle>
          <CardDescription>
            Each row's values as mapped onto the 15 canonical CRM fields, plus the Trust Layer's
            approval status and quality score for that row.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table
            columns={tableColumns}
            rows={records}
            rowKey={(record) => String(record.rowNumber)}
            caption="AI-extracted CRM records"
            emptyMessage="No records were extracted."
          />
        </CardContent>
      </Card>

      <RecordDiagnosticsPanel records={validation.records} />
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

/**
 * Prompt Engineering Platform observability — version, template, examples
 * selected, compiled size, token estimate, and compilation time. Never the
 * compiled prompt text itself, which `PromptExecutionMetadataDTO` doesn't carry.
 */
function PromptExecutionPanel({ metadata }: { metadata: PromptExecutionMetadataDTO }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prompt Execution</CardTitle>
        <CardDescription>
          How the prompt for this run was compiled — never the prompt text itself.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Template</span>
          <Badge variant="accent">{metadata.templateId}</Badge>
          <span className="text-xs text-muted-foreground">
            {metadata.promptVersion} · {metadata.promptHash}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <SummaryStat
            label="Context size"
            value={`${metadata.contextSizeChars.toLocaleString()} chars`}
          />
          <SummaryStat
            label="Prompt tokens"
            value={metadata.estimatedPromptTokens.toLocaleString()}
          />
          <SummaryStat
            label="Completion tokens (est.)"
            value={metadata.estimatedCompletionTokens.toLocaleString()}
          />
          <SummaryStat label="Compilation time" value={`${metadata.compilationTimeMs} ms`} />
          <SummaryStat label="Examples used" value={String(metadata.examplesUsed.length)} />
          <SummaryStat
            label="Negative examples used"
            value={String(metadata.negativeExamplesUsed.length)}
          />
        </dl>

        {metadata.validationWarnings.length > 0 ? (
          <ul className="space-y-2">
            {metadata.validationWarnings.map((warning, index) => (
              <li
                key={index}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
              >
                {warning}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Trust Layer dataset-level rollup — approved/needs-review/rejected/skipped
 * counts, average confidence, average quality score, and repair volume.
 * Never renders per-field detail; that's `RecordDiagnosticsPanel`'s job.
 */
function DatasetHealthPanel({ summary }: { summary: DatasetValidationSummaryDTO }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dataset Health</CardTitle>
        <CardDescription>
          The Trust Layer's verdict across every extracted record — nothing here is trusted
          automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">{summary.approvedCount} approved</Badge>
          <Badge variant="warning">{summary.needsReviewCount} needs review</Badge>
          <Badge variant="danger">{summary.rejectedCount} rejected</Badge>
          <Badge variant="neutral">{summary.skippedCount} skipped</Badge>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat
            label="Avg. confidence"
            value={`${Math.round(summary.averageConfidence * 100)}%`}
          />
          <SummaryStat label="Avg. quality score" value={String(summary.averageQualityScore)} />
          <SummaryStat label="Total repairs" value={String(summary.totalRepairs)} />
          <SummaryStat label="Records repaired" value={String(summary.recordsWithRepairs)} />
        </dl>
      </CardContent>
    </Card>
  );
}

/**
 * Per-record Trust Layer detail — approval reason, repair count, and every
 * validation/business/repair/approval issue that record raised. Only
 * records with at least one issue are shown; a clean, fully-approved record
 * has nothing to add beyond its table row.
 */
function RecordDiagnosticsPanel({ records }: { records: readonly ValidatedRecordDTO[] }) {
  const flagged = records.filter((record) => record.issues.length > 0);
  if (flagged.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record Diagnostics</CardTitle>
        <CardDescription>
          Validation, repair, and approval detail for every record the Trust Layer flagged.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="max-h-96 space-y-3 overflow-y-auto">
          {flagged.map((record) => (
            <li key={record.rowNumber} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">Row {record.rowNumber}</span>
                <Badge variant={APPROVAL_VARIANT[record.approvalStatus]}>
                  {APPROVAL_LABEL[record.approvalStatus]}
                </Badge>
                <span className="text-xs text-muted-foreground">{record.approvalReason}</span>
              </div>
              {record.repairCount > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {record.repairCount} repair{record.repairCount === 1 ? "" : "s"} applied
                </p>
              ) : null}
              <ul className="mt-2 space-y-1">
                {record.issues.map((issue, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    {issue}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function WarningsPanel({ warnings }: { warnings: AIExecutionReportDTO["warnings"] }) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Warnings</CardTitle>
        <CardDescription>Issues the schema validator flagged in the AI's response.</CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
