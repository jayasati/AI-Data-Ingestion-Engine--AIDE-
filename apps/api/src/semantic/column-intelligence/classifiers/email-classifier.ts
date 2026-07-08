import { looksLikeEmail } from "@/pipeline/ingestion/pattern-detectors";
import {
  buildClassifierResult,
  type ClassifierResult,
  type FieldClassifier,
} from "@/semantic/column-intelligence/classifiers/classifier-types";

export const emailClassifier: FieldClassifier = {
  id: "email",
  fieldId: "email",
  category: "regex",
  classify(values: readonly string[]): ClassifierResult {
    return buildClassifierResult(values, looksLikeEmail);
  },
};
