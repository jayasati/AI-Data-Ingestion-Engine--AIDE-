import type { DatasetContext } from "@/ai/context/dataset-context-builder";
import type { NormalizationReport } from "@/pipeline/domain/normalization";
import type { ColumnSemanticProfile } from "@/semantic/column-intelligence/column-analyzer";

export interface DatasetContextSectionInput {
  readonly datasetContext: DatasetContext;
  readonly normalizationReport: NormalizationReport;
  /** Optional richer per-column stats (uniqueness/entropy/length) from the Semantic Intelligence Engine — "Column Statistics" beyond the compact hints already in `datasetContext`. */
  readonly columnProfiles?: readonly ColumnSemanticProfile[];
}

const PERCENT = (ratio: number): string => `${Math.round(ratio * 100)}%`;

/**
 * The richest single section: dataset summary, detected type, per-column
 * type hints + semantic field candidates + statistics, and a normalization
 * rollup — everything the spec's Dataset Context Builder asks the LLM to
 * understand before it ever sees a record. Deliberately skips
 * "deterministic"-tier semantic mappings (see `formatSemanticMapping`) —
 * those never needed AI attention, so repeating them here would waste tokens.
 */
export function buildDatasetContextSection(input: DatasetContextSectionInput): string {
  const { datasetContext, normalizationReport, columnProfiles } = input;
  const profileByHeader = new Map(
    (columnProfiles ?? []).map((profile) => [profile.header, profile]),
  );
  const semanticByHeader = new Map(
    (datasetContext.semantics?.columns ?? []).map((c) => [c.header, c]),
  );

  const lines: string[] = ["# Dataset Context", `${datasetContext.totalRecords} record(s) total.`];

  if (datasetContext.semantics) {
    lines.push(
      `Detected dataset type: ${datasetContext.semantics.datasetType} (${PERCENT(datasetContext.semantics.datasetTypeConfidence)} confidence).`,
    );
  }

  lines.push("", "Columns:");
  for (const column of datasetContext.columns) {
    const typeHint = column.detectedTypeHint ? ` — looks like ${column.detectedTypeHint}` : "";
    const samples =
      column.sampleValues.length > 0 ? ` (e.g. ${column.sampleValues.join(", ")})` : "";
    const nullPercent = Math.round(column.nullRatio * 100);
    const stats = formatColumnStatistics(profileByHeader.get(column.header));
    lines.push(`  - "${column.header}"${typeHint}${samples}, ${nullPercent}% empty${stats}`);

    const mapping = formatSemanticMapping(semanticByHeader.get(column.header));
    if (mapping) {
      lines.push(`    ${mapping}`);
    }
  }

  lines.push("", buildNormalizationSummaryLine(normalizationReport));
  lines.push(
    "",
    "These hints come from deterministic analysis, not from you — treat them as guidance, not certainty.",
  );

  return lines.join("\n");
}

function formatColumnStatistics(profile: ColumnSemanticProfile | undefined): string {
  if (!profile) {
    return "";
  }
  return `, ${PERCENT(profile.uniquenessRatio)} unique, entropy ${profile.entropy.toFixed(2)}`;
}

function formatSemanticMapping(
  column: NonNullable<DatasetContext["semantics"]>["columns"][number] | undefined,
): string | null {
  if (!column || column.tier === "deterministic") {
    return null;
  }
  if (!column.topCandidateField) {
    return `Semantic mapping candidate: no confident guess, decide from the data alone.`;
  }
  const alternates =
    column.alternateCandidates.length > 0
      ? `; also consider: ${column.alternateCandidates
          .map((alt) => `${alt.fieldId} (${PERCENT(alt.confidence)})`)
          .join(", ")}`
      : "";
  return `Semantic mapping candidate: "${column.topCandidateField}" (${PERCENT(column.topCandidateConfidence)}, ${column.tier})${alternates}`;
}

function buildNormalizationSummaryLine(report: NormalizationReport): string {
  return [
    "Normalization summary:",
    `${report.totalFields} field(s) processed —`,
    `${report.emailsNormalized} email(s) (${report.invalidEmails} invalid),`,
    `${report.phonesNormalized} phone(s) (${report.invalidPhones} without a determinable country),`,
    `${report.datesParsed} date(s) (${report.failedDateParses} unresolved),`,
    `${report.numbersNormalized} number(s), ${report.booleansNormalized} boolean(s),`,
    `${report.nullValuesDetected} value(s) recognized as empty.`,
  ].join(" ");
}
