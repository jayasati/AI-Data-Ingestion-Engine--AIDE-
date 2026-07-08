import { looksLikePhone } from "@/pipeline/ingestion/pattern-detectors";
import {
  buildClassifierResult,
  type ClassifierResult,
  type FieldClassifier,
} from "@/semantic/column-intelligence/classifiers/classifier-types";

export const phoneClassifier: FieldClassifier = {
  id: "phone",
  fieldId: "phone",
  category: "regex",
  classify(values: readonly string[]): ClassifierResult {
    return buildClassifierResult(values, looksLikePhone);
  },
};
