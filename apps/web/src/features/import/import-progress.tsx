import { ImportStatus, type ResultSummary } from "@aide/shared-types";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_VARIANT: Record<ImportStatus, BadgeVariant> = {
  [ImportStatus.Pending]: "neutral",
  [ImportStatus.Processing]: "accent",
  [ImportStatus.Completed]: "success",
  [ImportStatus.Failed]: "danger",
  [ImportStatus.Cancelled]: "neutral",
};

const STATUS_LABEL: Record<ImportStatus, string> = {
  [ImportStatus.Pending]: "Pending",
  [ImportStatus.Processing]: "Processing",
  [ImportStatus.Completed]: "Completed",
  [ImportStatus.Failed]: "Failed",
  [ImportStatus.Cancelled]: "Cancelled",
};

function formatMs(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function IdlePlaceholder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Processing</CardTitle>
        <CardDescription>
          Live batch progress (batch X of N, imported and skipped counts) will stream here during a
          full import.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          aria-label="Import progress"
          className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
        >
          <div className="h-full w-0 rounded-full bg-accent-600" />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Waiting for an import to start…</p>
      </CardContent>
    </Card>
  );
}

/**
 * Polled live progress for a running import — the Execution Platform's own
 * `ImportProgressDTO`, read straight off `ResultSummary.progress`. Renders
 * the same idle shell `ProgressPlaceholder` used to when no import has
 * started yet, or once it's already terminal (`progress` is null then;
 * `ImportResultSummary` takes over).
 */
export function ImportProgress({ summary }: { summary: ResultSummary | null }) {
  if (!summary || !summary.progress) {
    return <IdlePlaceholder />;
  }

  const { progress } = summary;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Processing</CardTitle>
        <CardDescription>
          The Execution Platform's live batch progress for this import.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={STATUS_VARIANT[summary.status]}>{STATUS_LABEL[summary.status]}</Badge>
          {progress.currentBatchId ? (
            <span className="text-xs text-muted-foreground">Batch {progress.currentBatchId}</span>
          ) : null}
          {progress.currentStage ? (
            <span className="text-xs text-muted-foreground">Stage: {progress.currentStage}</span>
          ) : null}
        </div>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress.percentage)}
          aria-label="Import progress"
          className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
        >
          <div
            className="h-full rounded-full bg-accent-600 transition-all"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ProgressStat
            label="Processed"
            value={`${progress.completedRecords} / ${progress.totalRecords}`}
          />
          <ProgressStat label="Remaining" value={String(progress.remainingRecords)} />
          <ProgressStat
            label="Speed"
            value={`${progress.throughputRecordsPerSecond.toFixed(1)} rec/s`}
          />
          <ProgressStat
            label="ETA"
            value={
              progress.estimatedRemainingMs !== null ? formatMs(progress.estimatedRemainingMs) : "—"
            }
          />
        </dl>

        {summary.errorMessage ? (
          <p className="text-sm text-red-600 dark:text-red-400">{summary.errorMessage}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ProgressStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  );
}
