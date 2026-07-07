import type { ParsedDataset } from "@/pipeline/domain/parsing";
import type { HeaderProfile } from "@/pipeline/ingestion/header-engine";
import {
  looksLikeDate,
  looksLikeEmail,
  looksLikeNumeric,
  looksLikePhone,
} from "@/pipeline/ingestion/pattern-detectors";

export type ColumnDataTypeGuess = "email" | "phone" | "date" | "numeric" | "text" | "empty";

export interface ColumnDetectedPatterns {
  readonly potentialEmail: boolean;
  readonly potentialPhone: boolean;
  readonly potentialDate: boolean;
  readonly potentialNumeric: boolean;
}

/** Deterministic, AI-free profile of one column's values. A hint, never a CRM field mapping. */
export interface ColumnProfile {
  readonly columnIndex: number;
  readonly originalHeader: string;
  readonly normalizedHeader: string;
  readonly isDuplicateHeader: boolean;
  readonly dataTypeGuess: ColumnDataTypeGuess;
  /** 0-1 confidence in `dataTypeGuess`, the match ratio of the winning pattern. */
  readonly confidenceScore: number;
  readonly uniqueValueCount: number;
  readonly missingValueCount: number;
  readonly nullPercentage: number;
  readonly averageLength: number;
  readonly maxLength: number;
  readonly minLength: number;
  readonly sampleValues: readonly string[];
  readonly detectedPatterns: ColumnDetectedPatterns;
}

const SAMPLE_VALUE_LIMIT = 5;
/** A pattern must match at least half of a column's non-empty values to be reported. */
const MIN_TYPE_CONFIDENCE = 0.5;

interface ColumnAccumulator {
  readonly uniqueValues: Set<string>;
  missingValueCount: number;
  nonEmptyCount: number;
  totalLength: number;
  maxLength: number;
  minLength: number;
  readonly sampleValues: string[];
  emailMatches: number;
  phoneMatches: number;
  dateMatches: number;
  numericMatches: number;
}

function createAccumulator(): ColumnAccumulator {
  return {
    uniqueValues: new Set<string>(),
    missingValueCount: 0,
    nonEmptyCount: 0,
    totalLength: 0,
    maxLength: 0,
    minLength: 0,
    sampleValues: [],
    emailMatches: 0,
    phoneMatches: 0,
    dateMatches: 0,
    numericMatches: 0,
  };
}

/**
 * One pass over every row, updating a running accumulator per column —
 * never materializes a column-major copy of the dataset. Column count is
 * typically small (tens, not thousands), so the per-cell inner loop stays cheap
 * even for large row counts.
 */
export function buildColumnProfiles(
  dataset: ParsedDataset,
  headerProfiles: readonly HeaderProfile[],
): readonly ColumnProfile[] {
  const columnCount = dataset.columnCount;
  const accumulators: ColumnAccumulator[] = Array.from({ length: columnCount }, createAccumulator);

  for (const row of dataset.rows) {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const value = row.cells[columnIndex].trim();
      const accumulator = accumulators[columnIndex];

      if (value === "") {
        accumulator.missingValueCount += 1;
        continue;
      }

      accumulator.nonEmptyCount += 1;
      accumulator.uniqueValues.add(value);
      accumulator.totalLength += value.length;
      accumulator.maxLength = Math.max(accumulator.maxLength, value.length);
      accumulator.minLength =
        accumulator.nonEmptyCount === 1
          ? value.length
          : Math.min(accumulator.minLength, value.length);
      if (
        accumulator.sampleValues.length < SAMPLE_VALUE_LIMIT &&
        !accumulator.sampleValues.includes(value)
      ) {
        accumulator.sampleValues.push(value);
      }
      if (looksLikeEmail(value)) accumulator.emailMatches += 1;
      if (looksLikePhone(value)) accumulator.phoneMatches += 1;
      if (looksLikeDate(value)) accumulator.dateMatches += 1;
      if (looksLikeNumeric(value)) accumulator.numericMatches += 1;
    }
  }

  const totalRows = dataset.rowCount;

  return accumulators.map((accumulator, columnIndex) => {
    const headerProfile = headerProfiles[columnIndex];
    const classification = classifyColumn(accumulator);

    return {
      columnIndex,
      originalHeader: headerProfile.originalHeader,
      normalizedHeader: headerProfile.normalizedHeader,
      isDuplicateHeader: headerProfile.isDuplicate,
      dataTypeGuess: classification.dataTypeGuess,
      confidenceScore: classification.confidenceScore,
      uniqueValueCount: accumulator.uniqueValues.size,
      missingValueCount: accumulator.missingValueCount,
      nullPercentage: totalRows > 0 ? (accumulator.missingValueCount / totalRows) * 100 : 0,
      averageLength:
        accumulator.nonEmptyCount > 0 ? accumulator.totalLength / accumulator.nonEmptyCount : 0,
      maxLength: accumulator.maxLength,
      minLength: accumulator.minLength,
      sampleValues: accumulator.sampleValues,
      detectedPatterns: classification.detectedPatterns,
    };
  });
}

function classifyColumn(accumulator: ColumnAccumulator): {
  dataTypeGuess: ColumnDataTypeGuess;
  confidenceScore: number;
  detectedPatterns: ColumnDetectedPatterns;
} {
  const emptyPatterns: ColumnDetectedPatterns = {
    potentialEmail: false,
    potentialPhone: false,
    potentialDate: false,
    potentialNumeric: false,
  };

  if (accumulator.nonEmptyCount === 0) {
    return { dataTypeGuess: "empty", confidenceScore: 0, detectedPatterns: emptyPatterns };
  }

  const ratio = (matches: number): number => matches / accumulator.nonEmptyCount;
  const candidates: Array<[ColumnDataTypeGuess, number]> = [
    ["email", ratio(accumulator.emailMatches)],
    ["phone", ratio(accumulator.phoneMatches)],
    ["date", ratio(accumulator.dateMatches)],
    ["numeric", ratio(accumulator.numericMatches)],
  ];
  const [bestType, bestRatio] = candidates.reduce((best, current) =>
    current[1] > best[1] ? current : best,
  );

  const detectedPatterns: ColumnDetectedPatterns = {
    potentialEmail: ratio(accumulator.emailMatches) >= MIN_TYPE_CONFIDENCE,
    potentialPhone: ratio(accumulator.phoneMatches) >= MIN_TYPE_CONFIDENCE,
    potentialDate: ratio(accumulator.dateMatches) >= MIN_TYPE_CONFIDENCE,
    potentialNumeric: ratio(accumulator.numericMatches) >= MIN_TYPE_CONFIDENCE,
  };

  if (bestRatio >= MIN_TYPE_CONFIDENCE) {
    return { dataTypeGuess: bestType, confidenceScore: bestRatio, detectedPatterns };
  }
  return { dataTypeGuess: "text", confidenceScore: 0, detectedPatterns };
}
