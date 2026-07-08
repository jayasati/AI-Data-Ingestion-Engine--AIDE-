import { emailClassifier } from "@/semantic/column-intelligence/classifiers/email-classifier";
import { phoneClassifier } from "@/semantic/column-intelligence/classifiers/phone-classifier";
import { dateClassifier } from "@/semantic/column-intelligence/classifiers/date-classifier";
import { currencyClassifier } from "@/semantic/column-intelligence/classifiers/currency-classifier";
import { nameClassifier } from "@/semantic/column-intelligence/classifiers/name-classifier";
import { companyClassifier } from "@/semantic/column-intelligence/classifiers/company-classifier";
import { locationClassifier } from "@/semantic/column-intelligence/classifiers/location-classifier";
import { statusClassifier } from "@/semantic/column-intelligence/classifiers/status-classifier";

export type {
  ClassifierResult,
  FieldClassifier,
} from "@/semantic/column-intelligence/classifiers/classifier-types";
export { emailClassifier } from "@/semantic/column-intelligence/classifiers/email-classifier";
export { phoneClassifier } from "@/semantic/column-intelligence/classifiers/phone-classifier";
export { dateClassifier } from "@/semantic/column-intelligence/classifiers/date-classifier";
export { currencyClassifier } from "@/semantic/column-intelligence/classifiers/currency-classifier";
export { nameClassifier } from "@/semantic/column-intelligence/classifiers/name-classifier";
export { companyClassifier } from "@/semantic/column-intelligence/classifiers/company-classifier";
export { locationClassifier } from "@/semantic/column-intelligence/classifiers/location-classifier";
export { statusClassifier } from "@/semantic/column-intelligence/classifiers/status-classifier";

/** Registration point for new classifiers — add here, nowhere else needs to know. */
export const DEFAULT_CLASSIFIERS = [
  emailClassifier,
  phoneClassifier,
  dateClassifier,
  currencyClassifier,
  nameClassifier,
  companyClassifier,
  locationClassifier,
  statusClassifier,
];
