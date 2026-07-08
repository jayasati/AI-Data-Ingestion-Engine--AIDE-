import {
  buildClassifierResult,
  type ClassifierResult,
  type FieldClassifier,
} from "@/semantic/column-intelligence/classifiers/classifier-types";

const COMPANY_SUFFIXES = [
  "inc",
  "llc",
  "ltd",
  "limited",
  "pvt",
  "corp",
  "corporation",
  "co",
  "llp",
  "group",
  "enterprises",
  "industries",
  "solutions",
  "technologies",
  "traders",
  "associates",
  "ventures",
];

const SUFFIX_PATTERN = new RegExp(`\\b(${COMPANY_SUFFIXES.join("|")})\\.?\\s*$`, "i");

/**
 * Weak, value-only signal: most real company names carry no recognizable
 * suffix at all ("Google"), so this is deliberately treated as supporting
 * (PatternRule), not standalone, evidence — see rules/pattern-rule.ts.
 */
export const companyClassifier: FieldClassifier = {
  id: "company",
  fieldId: "company",
  category: "pattern",
  classify(values: readonly string[]): ClassifierResult {
    return buildClassifierResult(values, (value) => SUFFIX_PATTERN.test(value.trim()));
  },
};
