import type { PipelineStage, StageExecution } from "@/pipeline/contracts/pipeline-stage";
import type { StageWarning } from "@/pipeline/contracts/stage-result";
import type { PipelineContext } from "@/pipeline/context";
import type { ParsedDataset, ParsedRow } from "@/pipeline/domain/parsing";
import type { UploadContext } from "@/pipeline/domain/upload";
import { detectDelimiter } from "@/pipeline/stages/csv-parsing/delimiter-detector";
import { tokenizeCsv } from "@/pipeline/stages/csv-parsing/csv-tokenizer";
import { disambiguateHeaders } from "@/pipeline/stages/csv-parsing/header-disambiguator";
import { isBlankRecord, reconcileRowLength } from "@/pipeline/stages/csv-parsing/row-reconciler";
import { buildStageResult } from "@/pipeline/stages/shared/stage-result-factory";

const STAGE_NAME = "csv-parsing";

/**
 * Deterministic, AI-free: delimiter detection, RFC 4180–style tokenization,
 * header disambiguation, and ragged-row recovery. Never assigns meaning to a
 * column — that begins at the (still unimplemented) Semantic Extraction stage.
 */
export class CsvParsingStage implements PipelineStage<UploadContext, ParsedDataset> {
  readonly name = STAGE_NAME;

  async execute(
    input: UploadContext,
    context: PipelineContext,
  ): Promise<StageExecution<ParsedDataset>> {
    const startedAt = new Date();
    const content = input.uploadedFile.content;
    const delimiter = detectDelimiter(content);
    const allRecords = tokenizeCsv(content, delimiter);

    if (allRecords.length === 0) {
      return {
        context,
        result: buildStageResult<ParsedDataset>({
          stageName: STAGE_NAME,
          startedAt,
          metadata: { delimiter },
          errors: [{ code: "EMPTY_DATASET", message: "The file contains no rows to parse." }],
          outcome: "fatal_failure",
          output: null,
        }),
      };
    }

    const [rawHeaderRow, ...rawDataRecords] = allRecords;
    const { headers, duplicatesRenamed, emptyHeadersRenamed } = disambiguateHeaders(rawHeaderRow);

    if (emptyHeadersRenamed === headers.length) {
      return {
        context,
        result: buildStageResult<ParsedDataset>({
          stageName: STAGE_NAME,
          startedAt,
          metadata: { delimiter, headerCount: headers.length },
          errors: [
            {
              code: "HEADERLESS_FILE",
              message: "No header row could be identified; the first row has no column names.",
            },
          ],
          outcome: "fatal_failure",
          output: null,
        }),
      };
    }

    const nonBlankDataRecords = rawDataRecords.filter((record) => !isBlankRecord(record));
    const blankRowsSkipped = rawDataRecords.length - nonBlankDataRecords.length;

    let raggedRowCount = 0;
    const rows: ParsedRow[] = nonBlankDataRecords.map((cells, index) => {
      const reconciled = reconcileRowLength(cells, headers.length);
      if (reconciled !== cells) {
        raggedRowCount += 1;
      }
      return { rowNumber: index + 1, cells: reconciled };
    });

    const warnings = buildWarnings({
      blankRowsSkipped,
      duplicatesRenamed,
      emptyHeadersRenamed,
      raggedRowCount,
    });

    const output: ParsedDataset = {
      headers,
      rows,
      delimiter,
      rowCount: rows.length,
      columnCount: headers.length,
    };

    const nextContext = context.mergeStatistics({
      rowsParsed: rows.length,
      columnCount: headers.length,
    });

    return {
      context: nextContext,
      result: buildStageResult({
        stageName: STAGE_NAME,
        startedAt,
        metadata: {
          delimiter,
          headerCount: headers.length,
          rowsParsed: rows.length,
          blankRowsSkipped,
          duplicateHeadersRenamed: duplicatesRenamed,
          raggedRowCount,
        },
        warnings,
        outcome: warnings.length > 0 ? "warning" : "success",
        output,
      }),
    };
  }
}

function buildWarnings(counts: {
  blankRowsSkipped: number;
  duplicatesRenamed: number;
  emptyHeadersRenamed: number;
  raggedRowCount: number;
}): StageWarning[] {
  const warnings: StageWarning[] = [];

  if (counts.blankRowsSkipped > 0) {
    warnings.push({
      code: "BLANK_ROWS_SKIPPED",
      message: `${counts.blankRowsSkipped} blank row(s) were skipped.`,
      context: { count: counts.blankRowsSkipped },
    });
  }
  if (counts.duplicatesRenamed > 0) {
    warnings.push({
      code: "DUPLICATE_HEADERS_RENAMED",
      message: `${counts.duplicatesRenamed} duplicate header(s) were disambiguated.`,
      context: { count: counts.duplicatesRenamed },
    });
  }
  if (counts.emptyHeadersRenamed > 0) {
    warnings.push({
      code: "EMPTY_HEADER_NAMES",
      message: `${counts.emptyHeadersRenamed} column(s) had no header name and received a placeholder.`,
      context: { count: counts.emptyHeadersRenamed },
    });
  }
  if (counts.raggedRowCount > 0) {
    warnings.push({
      code: "RAGGED_ROWS_ADJUSTED",
      message: `${counts.raggedRowCount} row(s) had a different column count than the header and were padded or truncated.`,
      context: { count: counts.raggedRowCount },
    });
  }

  return warnings;
}
