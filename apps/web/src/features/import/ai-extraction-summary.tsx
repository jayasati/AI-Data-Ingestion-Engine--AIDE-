import type { ReactNode } from "react";
import type {
  AIExecutionReportDTO,
  AIExtractResponse,
  ExtractedRecordDTO,
  PromptExecutionMetadataDTO,
} from "@aide/shared-types";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, type TableColumn } from "@/components/ui/table";

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
  const { records, recordCount, report } = result;

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

      <Card>
        <CardHeader>
          <CardTitle>Extracted Records</CardTitle>
          <CardDescription>
            Each row's values as mapped onto the 15 canonical CRM fields.
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
