import { looksLikeDate } from "@/pipeline/ingestion/pattern-detectors";
import {
  buildClassifierResult,
  type ClassifierResult,
  type FieldClassifier,
} from "@/semantic/column-intelligence/classifiers/classifier-types";

/**
 * Targets "created_at" — the only date-shaped field in the semantic
 * vocabulary. A column that looks like dates but clearly isn't a creation
 * timestamp (e.g. a birthdate column) still surfaces here; disambiguating
 * that is exactly the kind of low-confidence case Hybrid Mapping defers to AI.
 */
export const dateClassifier: FieldClassifier = {
  id: "date",
  fieldId: "created_at",
  category: "regex",
  classify(values: readonly string[]): ClassifierResult {
    return buildClassifierResult(values, looksLikeDate);
  },
};
