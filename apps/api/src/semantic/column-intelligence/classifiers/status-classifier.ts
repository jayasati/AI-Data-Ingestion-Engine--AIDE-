import {
  buildClassifierResult,
  type ClassifierResult,
  type FieldClassifier,
} from "@/semantic/column-intelligence/classifiers/classifier-types";

const STATUS_KEYWORDS = [
  "new",
  "open",
  "closed",
  "won",
  "lost",
  "contacted",
  "qualified",
  "follow up",
  "followup",
  "interested",
  "not interested",
  "converted",
  "junk",
  "hot",
  "warm",
  "cold",
  "in progress",
  "pending",
  "active",
  "inactive",
  "sale done",
  "did not connect",
  "bad lead",
  "good lead",
];

const LOW_CARDINALITY_UNIQUE_RATIO = 0.3;
const LOW_CARDINALITY_MAX_UNIQUE = 15;
const LOW_CARDINALITY_MIN_SAMPLE = 5;
const WEAK_CARDINALITY_MATCH_RATIO = 0.3;

/**
 * Heuristic only, as the spec requires — there is no reliable regex for
 * "is this a status." Keyword hits are the strong signal; when none exist,
 * a flat low-cardinality fallback still lets a genuinely enum-like column
 * (whatever its actual vocabulary) contribute weak supporting evidence.
 */
export const statusClassifier: FieldClassifier = {
  id: "status",
  fieldId: "crm_status",
  category: "pattern",
  classify(values: readonly string[]): ClassifierResult {
    const keywordResult = buildClassifierResult(values, (value) =>
      STATUS_KEYWORDS.includes(value.trim().toLowerCase()),
    );
    if (keywordResult.matchRatio > 0) {
      return keywordResult;
    }

    if (values.length < LOW_CARDINALITY_MIN_SAMPLE) {
      return { matchRatio: 0, evidence: [] };
    }
    const uniqueCount = new Set(values).size;
    const uniqueRatio = uniqueCount / values.length;
    const isLowCardinality =
      uniqueRatio <= LOW_CARDINALITY_UNIQUE_RATIO && uniqueCount <= LOW_CARDINALITY_MAX_UNIQUE;

    return isLowCardinality
      ? { matchRatio: WEAK_CARDINALITY_MATCH_RATIO, evidence: [...new Set(values)].slice(0, 3) }
      : { matchRatio: 0, evidence: [] };
  },
};
