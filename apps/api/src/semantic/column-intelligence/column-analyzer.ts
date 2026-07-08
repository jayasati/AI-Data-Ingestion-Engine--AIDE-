import type { NormalizedDataset } from "@/pipeline/domain/normalization";
import { normalizedShannonEntropy } from "@/semantic/column-intelligence/entropy";
import {
  DEFAULT_CLASSIFIERS,
  type ClassifierResult,
  type FieldClassifier,
} from "@/semantic/column-intelligence/classifiers";
import { DEFAULT_SEMANTIC_CONFIG, type SemanticConfig } from "@/semantic/config/semantic-config";
import type { SemanticFieldId } from "@/semantic/types";

const EMPTY_CLASSIFIER_RESULT: ClassifierResult = { matchRatio: 0, evidence: [] };

/**
 * Column Intelligence's output: a value-driven profile per column, entirely
 * independent of what the header says. `regexSignals`/`patternSignals` feed
 * the Confidence Engine's RegexRule/PatternRule; the `likely*` flags are the
 * plain descriptive summary the spec and the Semantic Report both want.
 */
export interface ColumnSemanticProfile {
  readonly columnIndex: number;
  readonly header: string;
  readonly nonEmptyCount: number;
  readonly uniqueValueCount: number;
  readonly uniquenessRatio: number;
  readonly nullPercentage: number;
  readonly averageLength: number;
  readonly entropy: number;
  readonly likelyEmail: boolean;
  readonly likelyPhone: boolean;
  readonly likelyDate: boolean;
  readonly likelyCurrency: boolean;
  readonly likelyName: boolean;
  readonly likelyCompany: boolean;
  readonly likelyLocation: boolean;
  readonly regexSignals: Readonly<Partial<Record<SemanticFieldId, ClassifierResult>>>;
  readonly patternSignals: Readonly<Partial<Record<SemanticFieldId, ClassifierResult>>>;
  readonly locationSignal: ClassifierResult;
}

/**
 * One pass over the normalized dataset's records per column — cheap even for
 * datasets with hundreds of columns, since row count dominates and this
 * never materializes a column-major copy of the whole dataset.
 */
export function analyzeColumns(
  dataset: NormalizedDataset,
  classifiers: readonly FieldClassifier[] = DEFAULT_CLASSIFIERS,
  config: SemanticConfig = DEFAULT_SEMANTIC_CONFIG,
): readonly ColumnSemanticProfile[] {
  return dataset.headers.map((header, columnIndex) => {
    const values: string[] = [];
    for (const record of dataset.records) {
      const value = record.fields[columnIndex]?.normalizedValue;
      if (value !== null && value !== undefined && value !== "") {
        values.push(value);
      }
    }

    const nonEmptyCount = values.length;
    const uniqueValueCount = new Set(values).size;
    const totalLength = values.reduce((sum, value) => sum + value.length, 0);

    const regexSignals: Partial<Record<SemanticFieldId, ClassifierResult>> = {};
    const patternSignals: Partial<Record<SemanticFieldId, ClassifierResult>> = {};
    const resultsByClassifierId = new Map<string, ClassifierResult>();

    for (const classifier of classifiers) {
      const result = classifier.classify(values);
      resultsByClassifierId.set(classifier.id, result);
      if (classifier.fieldId) {
        const bucket = classifier.category === "regex" ? regexSignals : patternSignals;
        bucket[classifier.fieldId] = result;
      }
    }

    const likely = (classifierId: string): boolean =>
      (resultsByClassifierId.get(classifierId)?.matchRatio ?? 0) >=
      config.classifierLikelyThreshold;

    return {
      columnIndex,
      header,
      nonEmptyCount,
      uniqueValueCount,
      uniquenessRatio: nonEmptyCount > 0 ? uniqueValueCount / nonEmptyCount : 0,
      nullPercentage:
        dataset.recordCount > 0
          ? ((dataset.recordCount - nonEmptyCount) / dataset.recordCount) * 100
          : 0,
      averageLength: nonEmptyCount > 0 ? totalLength / nonEmptyCount : 0,
      entropy: normalizedShannonEntropy(values),
      likelyEmail: likely("email"),
      likelyPhone: likely("phone"),
      likelyDate: likely("date"),
      likelyCurrency: likely("currency"),
      likelyName: likely("name"),
      likelyCompany: likely("company"),
      likelyLocation: likely("location"),
      regexSignals,
      patternSignals,
      locationSignal: resultsByClassifierId.get("location") ?? EMPTY_CLASSIFIER_RESULT,
    };
  });
}
