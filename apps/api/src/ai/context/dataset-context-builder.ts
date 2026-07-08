import type { NormalizedDataset } from "@/pipeline/domain/normalization";

export interface ColumnContextSummary {
  readonly header: string;
  /** Majority vote over the column's NormalizedField.details.kind, e.g. "email"/"phone"/"date"/"number"/"boolean". */
  readonly detectedTypeHint: string | null;
  readonly sampleValues: readonly string[];
  readonly nullRatio: number;
}

export interface DatasetContext {
  readonly totalRecords: number;
  readonly headers: readonly string[];
  readonly columns: readonly ColumnContextSummary[];
}

const SAMPLE_VALUE_LIMIT = 5;

/**
 * Builds AI-facing dataset context directly from the Normalization Engine's
 * own output — no re-analysis. Volume 4's rule engine already determined,
 * per cell, what a value looks like (email/phone/date/number/boolean); this
 * just rolls that up per column so the prompt can say "column 'Contact'
 * looks like phone numbers" instead of the AI guessing from raw text alone.
 */
export function buildDatasetContext(dataset: NormalizedDataset): DatasetContext {
  const columns = dataset.headers.map((header, columnIndex) =>
    buildColumnSummary(header, columnIndex, dataset),
  );

  return {
    totalRecords: dataset.recordCount,
    headers: dataset.headers,
    columns,
  };
}

function buildColumnSummary(
  header: string,
  columnIndex: number,
  dataset: NormalizedDataset,
): ColumnContextSummary {
  const kindCounts = new Map<string, number>();
  const sampleValues: string[] = [];
  let nullCount = 0;

  for (const record of dataset.records) {
    const field = record.fields[columnIndex];
    if (!field) {
      continue;
    }
    if (field.normalizedValue === null) {
      nullCount += 1;
      continue;
    }
    if (field.details) {
      kindCounts.set(field.details.kind, (kindCounts.get(field.details.kind) ?? 0) + 1);
    }
    if (sampleValues.length < SAMPLE_VALUE_LIMIT && !sampleValues.includes(field.normalizedValue)) {
      sampleValues.push(field.normalizedValue);
    }
  }

  let detectedTypeHint: string | null = null;
  let bestCount = 0;
  for (const [kind, count] of kindCounts) {
    if (count > bestCount) {
      bestCount = count;
      detectedTypeHint = kind;
    }
  }

  return {
    header,
    detectedTypeHint,
    sampleValues,
    nullRatio: dataset.recordCount > 0 ? nullCount / dataset.recordCount : 0,
  };
}
