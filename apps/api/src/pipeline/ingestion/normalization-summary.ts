import type { NormalizationReport, NormalizedDataset } from "@/pipeline/domain/normalization";

export interface NormalizationFieldIssue {
  readonly rowNumber: number;
  readonly header: string;
  readonly message: string;
  readonly status: "warning" | "failed";
}

/**
 * Preview-facing summary of a NormalizedDataset — mirrors how dataset-profiler.ts
 * derives DatasetMetadata from a ParsedDataset. Never exposes rule ids or the
 * per-rule `details` payload; only counts, a health score, and a capped list
 * of human-readable field issues, per the volume's "do not expose
 * implementation details" instruction for the frontend.
 */
export interface NormalizationSummary {
  readonly report: NormalizationReport;
  readonly healthScore: number;
  readonly fieldIssues: readonly NormalizationFieldIssue[];
  readonly totalIssueCount: number;
}

const FIELD_ISSUE_CAP = 25;

const HEALTH_PENALTY_WEIGHTS = {
  warningRatio: 40,
  failedRatio: 60,
};

function computeHealthScore(report: NormalizationReport): number {
  const warningRatio = report.totalFields > 0 ? report.fieldsWithWarnings / report.totalFields : 0;
  const failedRatio = report.totalFields > 0 ? report.fieldsFailed / report.totalFields : 0;
  const penalty =
    warningRatio * HEALTH_PENALTY_WEIGHTS.warningRatio +
    failedRatio * HEALTH_PENALTY_WEIGHTS.failedRatio;
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

function collectFieldIssues(dataset: NormalizedDataset): NormalizationFieldIssue[] {
  const issues: NormalizationFieldIssue[] = [];

  for (const record of dataset.records) {
    for (const field of record.fields) {
      if (field.status !== "warning" && field.status !== "failed") {
        continue;
      }
      if (field.warnings.length === 0) {
        issues.push({
          rowNumber: record.rowNumber,
          header: field.header,
          message: "Normalization issue.",
          status: field.status,
        });
        continue;
      }
      for (const warning of field.warnings) {
        issues.push({
          rowNumber: record.rowNumber,
          header: field.header,
          message: warning.message,
          status: field.status,
        });
      }
    }
  }

  return issues;
}

export function buildNormalizationSummary(dataset: NormalizedDataset): NormalizationSummary {
  const fieldIssues = collectFieldIssues(dataset);

  return {
    report: dataset.report,
    healthScore: computeHealthScore(dataset.report),
    fieldIssues: fieldIssues.slice(0, FIELD_ISSUE_CAP),
    totalIssueCount: fieldIssues.length,
  };
}
