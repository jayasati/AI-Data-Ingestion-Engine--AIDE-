import type { PipelineStage, StageExecution } from "@/pipeline/contracts/pipeline-stage";
import type { PipelineContext } from "@/pipeline/context";
import type {
  NormalizedCell,
  NormalizedDataset,
  NormalizedRecord,
} from "@/pipeline/domain/normalization";
import type { ParsedDataset } from "@/pipeline/domain/parsing";
import { isEmptyToken } from "@/pipeline/stages/normalization/empty-token-detector";
import { normalizeUnicode } from "@/pipeline/stages/normalization/unicode-normalizer";
import {
  trimAndCollapseWhitespace,
  unifyLineBreaks,
} from "@/pipeline/stages/normalization/whitespace-normalizer";
import { buildStageResult } from "@/pipeline/stages/shared/stage-result-factory";

const STAGE_NAME = "normalization";

/**
 * Structural cleanup only: whitespace, empty-value tokens, Unicode form, and
 * line-break representation. Field-aware normalization (emails, phones,
 * dates) is a later volume — this stage never inspects what a column means.
 */
export class NormalizationStage implements PipelineStage<ParsedDataset, NormalizedDataset> {
  readonly name = STAGE_NAME;

  async execute(
    input: ParsedDataset,
    context: PipelineContext,
  ): Promise<StageExecution<NormalizedDataset>> {
    const startedAt = new Date();

    let cellsTrimmed = 0;
    let cellsEmptyNormalized = 0;
    let unicodeNormalizedCount = 0;

    const records: NormalizedRecord[] = input.rows.map((row) => {
      const cells: NormalizedCell[] = row.cells.map((originalValue, index) => {
        const header = input.headers[index];
        const unicodeResult = normalizeUnicode(originalValue);
        if (unicodeResult.changed) {
          unicodeNormalizedCount += 1;
        }

        const structural = trimAndCollapseWhitespace(unifyLineBreaks(unicodeResult.value));
        const wasTrimmed = structural !== unicodeResult.value;
        if (wasTrimmed) {
          cellsTrimmed += 1;
        }

        const wasEmptyNormalized = isEmptyToken(structural);
        if (wasEmptyNormalized) {
          cellsEmptyNormalized += 1;
        }

        return {
          header,
          originalValue,
          normalizedValue: wasEmptyNormalized ? null : structural,
          wasTrimmed,
          wasEmptyNormalized,
        };
      });

      return { rowNumber: row.rowNumber, cells };
    });

    const output: NormalizedDataset = {
      headers: input.headers,
      records,
      recordCount: records.length,
    };

    const nextContext = context.mergeStatistics({ rowsNormalized: records.length });

    return {
      context: nextContext,
      result: buildStageResult({
        stageName: STAGE_NAME,
        startedAt,
        metadata: {
          recordsProcessed: records.length,
          cellsTrimmed,
          cellsEmptyNormalized,
          unicodeNormalizedCount,
        },
        outcome: "success",
        output,
      }),
    };
  }
}
