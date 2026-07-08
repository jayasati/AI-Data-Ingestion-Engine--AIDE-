import type { BatchSummaryDTO, ResultSummary } from "@aide/shared-types";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, type TableColumn } from "@/components/ui/table";

const BATCH_STATUS_VARIANT: Record<BatchSummaryDTO["status"], BadgeVariant> = {
  pending: "neutral",
  running: "accent",
  completed: "success",
  failed: "danger",
  cancelled: "neutral",
};

const RESULT_METRICS = ["Imported", "Skipped", "Success rate", "Duration"] as const;

function formatMs(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function formatFraction(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function IdlePlaceholder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Results</CardTitle>
        <CardDescription>
          The final summary — imported records, skipped records with reasons, and export options —
          lands here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {RESULT_METRICS.map((metric) => (
            <div key={metric} className="rounded-lg border border-border bg-surface-muted p-4">
              <dt className="text-xs text-muted-foreground">{metric}</dt>
              <dd className="mt-1 text-xl font-semibold">—</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

/**
 * The Aggregation Engine's final `ImportResult`, as delivered through
 * `ResultSummary` — dataset-level counts, then a per-batch table so a
 * partial-success run (some batches failed) is visible at a glance, not
 * just implied by a lower imported count.
 */
export function ImportResultSummary({ summary }: { summary: ResultSummary | null }) {
  if (!summary || summary.progress) {
    return <IdlePlaceholder />;
  }

  const successRate = summary.totalRows > 0 ? summary.importedCount / summary.totalRows : null;

  const tableColumns: TableColumn<BatchSummaryDTO>[] = [
    {
      key: "sequenceNumber",
      header: "#",
      className: "text-muted-foreground",
      render: (b) => b.sequenceNumber,
    },
    {
      key: "batchId",
      header: "Batch",
      render: (b) => <span className="font-mono text-xs">{b.batchId}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (b) => <Badge variant={BATCH_STATUS_VARIANT[b.status]}>{b.status}</Badge>,
    },
    { key: "recordCount", header: "Records", render: (b) => b.recordCount },
    {
      key: "durationMs",
      header: "Duration",
      render: (b) => (b.durationMs !== null ? formatMs(b.durationMs) : "—"),
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            The final summary from the Execution Platform's Aggregation Engine.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ResultStat label="Imported" value={String(summary.importedCount)} />
            <ResultStat label="Needs review" value={String(summary.needsReviewCount)} />
            <ResultStat label="Rejected" value={String(summary.rejectedCount)} />
            <ResultStat label="Skipped" value={String(summary.skippedCount)} />
            <ResultStat label="Success rate" value={formatFraction(successRate)} />
            <ResultStat label="Avg. confidence" value={formatFraction(summary.averageConfidence)} />
            <ResultStat
              label="Avg. quality score"
              value={
                summary.averageQualityScore !== null
                  ? String(Math.round(summary.averageQualityScore))
                  : "—"
              }
            />
            <ResultStat label="Duration" value={formatMs(summary.durationMs)} />
          </dl>

          {summary.failedBatches > 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              {summary.failedBatches} of {summary.batches.length} batches failed — their records are
              not included above (partial success; nothing else was discarded).
            </p>
          ) : null}

          {summary.errorMessage ? (
            <p className="text-sm text-red-600 dark:text-red-400">{summary.errorMessage}</p>
          ) : null}
        </CardContent>
      </Card>

      {summary.batches.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Batch Summary</CardTitle>
            <CardDescription>
              Every batch the Batch Scheduler created for this import.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table
              columns={tableColumns}
              rows={summary.batches}
              rowKey={(b) => b.batchId}
              caption="Import batch summary"
              emptyMessage="No batches were scheduled."
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold">{value}</dd>
    </div>
  );
}
