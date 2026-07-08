import type { ReactNode } from "react";
import type { NormalizationSummaryDTO } from "@aide/shared-types";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function healthVariant(score: number): BadgeVariant {
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "danger";
}

function healthLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 50) return "Needs review";
  return "Poor";
}

/**
 * Human-readable labels only — the report's raw counter names
 * (whitespaceNormalizedCount, invalidEmails, ...) are internal to the
 * Normalization Engine and never shown directly, per the "do not expose
 * implementation details" requirement.
 */
function buildStatLines(
  report: NormalizationSummaryDTO["report"],
): Array<{ label: string; value: string }> {
  const lines: Array<{ label: string; value: string }> = [
    { label: "Formatting fixes", value: String(report.whitespaceNormalizedCount) },
  ];

  if (report.unicodeNormalizedCount > 0) {
    lines.push({
      label: "Special characters cleaned",
      value: String(report.unicodeNormalizedCount),
    });
  }
  lines.push({ label: "Empty values recognized", value: String(report.nullValuesDetected) });
  lines.push({
    label: "Emails cleaned",
    value:
      report.invalidEmails > 0
        ? `${report.emailsNormalized} (${report.invalidEmails} invalid)`
        : String(report.emailsNormalized),
  });
  lines.push({
    label: "Phone numbers formatted",
    value:
      report.invalidPhones > 0
        ? `${report.phonesNormalized} (${report.invalidPhones} without a country code)`
        : String(report.phonesNormalized),
  });
  lines.push({
    label: "Dates parsed",
    value:
      report.failedDateParses > 0
        ? `${report.datesParsed} (${report.failedDateParses} unresolved)`
        : String(report.datesParsed),
  });
  lines.push({ label: "Numbers parsed", value: String(report.numbersNormalized) });
  lines.push({ label: "Yes/No values normalized", value: String(report.booleansNormalized) });

  return lines;
}

export function NormalizationSummary({
  normalization,
}: {
  normalization: NormalizationSummaryDTO;
}) {
  const { report, healthScore, warnings, fieldIssues, totalIssueCount } = normalization;
  const statLines = buildStatLines(report);
  const hiddenIssueCount = totalIssueCount - fieldIssues.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Normalization</CardTitle>
        <CardDescription>
          Deterministic formatting cleanup applied before any AI processing — whitespace, emails,
          phone numbers, dates, and more.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Dataset health</span>
          <Badge variant={healthVariant(healthScore)}>
            {healthScore}/100 · {healthLabel(healthScore)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {report.totalFields} field{report.totalFields === 1 ? "" : "s"} processed
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {statLines.map((line) => (
            <StatTile key={line.label} label={line.label} value={line.value} />
          ))}
        </dl>

        {warnings.length > 0 ? (
          <ul className="space-y-2">
            {warnings.map((warning, index) => (
              <li
                key={index}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
              >
                {warning.message}
              </li>
            ))}
          </ul>
        ) : null}

        <FieldIssuesList
          issues={fieldIssues}
          hiddenIssueCount={hiddenIssueCount}
          totalIssueCount={totalIssueCount}
        />
      </CardContent>
    </Card>
  );
}

function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  );
}

function FieldIssuesList({
  issues,
  hiddenIssueCount,
  totalIssueCount,
}: {
  issues: NormalizationSummaryDTO["fieldIssues"];
  hiddenIssueCount: number;
  totalIssueCount: number;
}) {
  if (totalIssueCount === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No field issues — everything normalized cleanly.
      </p>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium">Field issues</h3>
      <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto">
        {issues.map((issue, index) => (
          <li
            key={index}
            className="flex items-start gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm"
          >
            <span
              aria-label={issue.status === "failed" ? "Failed" : "Warning"}
              className={
                issue.status === "failed"
                  ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500"
                  : "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500"
              }
            />
            <span>
              <span className="font-medium">
                Row {issue.rowNumber} · {issue.header}
              </span>
              <span className="block text-muted-foreground">{issue.message}</span>
            </span>
          </li>
        ))}
      </ul>
      {hiddenIssueCount > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing {issues.length} of {totalIssueCount} issues.
        </p>
      ) : null}
    </div>
  );
}
