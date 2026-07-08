import type { PipelineStage, StageExecution } from "@/pipeline/contracts/pipeline-stage";
import type { StageOutcome, StageWarning } from "@/pipeline/contracts/stage-result";
import type { PipelineContext } from "@/pipeline/context";
import type {
  NormalizationReport,
  NormalizedDataset,
  NormalizedField,
  NormalizedRecord,
} from "@/pipeline/domain/normalization";
import type { ParsedDataset } from "@/pipeline/domain/parsing";
import { FieldNormalizationEngine } from "@/pipeline/stages/normalization/rule-engine";
import { buildStageResult } from "@/pipeline/stages/shared/stage-result-factory";

const STAGE_NAME = "normalization";

type ReportAccumulator = {
  -readonly [K in keyof NormalizationReport]: NormalizationReport[K];
};

function createAccumulator(): ReportAccumulator {
  return {
    totalFields: 0,
    whitespaceNormalizedCount: 0,
    unicodeNormalizedCount: 0,
    nullValuesDetected: 0,
    emailsNormalized: 0,
    invalidEmails: 0,
    phonesNormalized: 0,
    invalidPhones: 0,
    datesParsed: 0,
    failedDateParses: 0,
    numbersNormalized: 0,
    booleansNormalized: 0,
    fieldsWithWarnings: 0,
    fieldsFailed: 0,
  };
}

function tally(accumulator: ReportAccumulator, field: NormalizedField): void {
  accumulator.totalFields += 1;
  if (field.appliedRules.includes("whitespace")) accumulator.whitespaceNormalizedCount += 1;
  if (field.appliedRules.includes("unicode")) accumulator.unicodeNormalizedCount += 1;
  if (field.appliedRules.includes("null")) accumulator.nullValuesDetected += 1;

  if (field.details?.kind === "email") {
    if (field.details.isValid) accumulator.emailsNormalized += 1;
    else accumulator.invalidEmails += 1;
  }
  if (field.details?.kind === "phone") {
    if (field.details.e164) accumulator.phonesNormalized += 1;
    else accumulator.invalidPhones += 1;
  }
  if (field.details?.kind === "date") {
    if (field.details.iso) accumulator.datesParsed += 1;
    else accumulator.failedDateParses += 1;
  }
  if (field.details?.kind === "number" && field.details.value !== null) {
    accumulator.numbersNormalized += 1;
  }
  if (field.details?.kind === "boolean" && field.details.value !== null) {
    accumulator.booleansNormalized += 1;
  }

  if (field.status === "warning") accumulator.fieldsWithWarnings += 1;
  if (field.status === "failed") accumulator.fieldsFailed += 1;
}

function buildSummaryWarnings(report: NormalizationReport): StageWarning[] {
  const warnings: StageWarning[] = [];

  if (report.invalidEmails > 0) {
    warnings.push({
      code: "INVALID_EMAILS",
      message: `${report.invalidEmails} email field(s) did not look syntactically valid.`,
      context: { count: report.invalidEmails },
    });
  }
  if (report.invalidPhones > 0) {
    warnings.push({
      code: "PHONES_WITHOUT_COUNTRY",
      message: `${report.invalidPhones} phone field(s) had no determinable country code.`,
      context: { count: report.invalidPhones },
    });
  }
  if (report.failedDateParses > 0) {
    warnings.push({
      code: "UNRESOLVED_DATES",
      message: `${report.failedDateParses} date field(s) could not be parsed or were ambiguous.`,
      context: { count: report.failedDateParses },
    });
  }
  if (report.fieldsFailed > 0) {
    warnings.push({
      code: "FIELDS_FAILED",
      message: `${report.fieldsFailed} field(s) failed normalization due to an internal error.`,
      context: { count: report.fieldsFailed },
    });
  }

  return warnings;
}

/**
 * Deterministic, rule-engine-driven field normalization: whitespace, Unicode,
 * null-alias, email, phone, date, number, and boolean rules, run per cell
 * through FieldNormalizationEngine. Never AI, never semantic/CRM mapping —
 * this stage only understands formatting, not meaning. A field-level failure
 * never stops the pipeline: see FieldNormalizationEngine's try/catch and the
 * "failed" NormalizationStatus, which preserves the original value and
 * records a warning instead.
 */
export class NormalizationStage implements PipelineStage<ParsedDataset, NormalizedDataset> {
  readonly name = STAGE_NAME;
  private readonly engine = new FieldNormalizationEngine();

  async execute(
    input: ParsedDataset,
    context: PipelineContext,
  ): Promise<StageExecution<NormalizedDataset>> {
    const startedAt = new Date();
    const accumulator = createAccumulator();

    const records: NormalizedRecord[] = input.rows.map((row) => {
      const fields: NormalizedField[] = row.cells.map((rawValue, index) => {
        const field = this.engine.normalizeValue(rawValue, {
          header: input.headers[index],
          columnIndex: index,
        });
        tally(accumulator, field);
        return field;
      });

      const warnings = fields.flatMap((field) => field.warnings);
      const hasErrors = fields.some((field) => field.status === "failed");
      return { rowNumber: row.rowNumber, fields, warnings, hasErrors };
    });

    const report: NormalizationReport = { ...accumulator };
    const warnings = buildSummaryWarnings(report);

    const output: NormalizedDataset = {
      headers: input.headers,
      records,
      recordCount: records.length,
      report,
    };

    const nextContext = context.mergeStatistics({
      rowsNormalized: records.length,
      fieldsNormalized: report.totalFields,
      fieldsWithWarnings: report.fieldsWithWarnings,
    });

    const outcome: StageOutcome =
      report.fieldsWithWarnings > 0 || report.fieldsFailed > 0 ? "warning" : "success";

    return {
      context: nextContext,
      result: buildStageResult({
        stageName: STAGE_NAME,
        startedAt,
        metadata: { ...report },
        warnings,
        outcome,
        output,
      }),
    };
  }
}
