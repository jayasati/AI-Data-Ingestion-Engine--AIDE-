import {
  buildClassifierResult,
  type ClassifierResult,
  type FieldClassifier,
} from "@/semantic/column-intelligence/classifiers/classifier-types";

const CURRENCY_PATTERN = /^[+-]?(?:[$€£¥₹]|Rs\.?|USD|EUR|GBP|INR)\s?[\d,]+(?:\.\d+)?%?$/i;

/**
 * Descriptive only (`fieldId: null`) — there is no CRM field for a bare
 * monetary amount, so this never proposes a candidate mapping. It exists
 * purely to power the `likelyCurrency` flag the Column Intelligence spec
 * calls for.
 */
export const currencyClassifier: FieldClassifier = {
  id: "currency",
  fieldId: null,
  category: "regex",
  classify(values: readonly string[]): ClassifierResult {
    return buildClassifierResult(values, (value) => CURRENCY_PATTERN.test(value.trim()));
  },
};
