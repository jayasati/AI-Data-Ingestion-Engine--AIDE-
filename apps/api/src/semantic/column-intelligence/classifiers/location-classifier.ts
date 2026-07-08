import {
  buildClassifierResult,
  type ClassifierResult,
  type FieldClassifier,
} from "@/semantic/column-intelligence/classifiers/classifier-types";

/**
 * A necessarily small, curated gazetteer — never exhaustive. Covers common
 * countries plus Indian states/major cities, since the assignment's target
 * CRM (GrowEasy) is India-focused. Descriptive only (`fieldId: null`): a
 * gazetteer hit can't by itself tell city from state from country, so it
 * only reinforces whichever of those three the header already hypothesized
 * (see rules/pattern-rule.ts).
 */
const COUNTRIES = [
  "india",
  "united states",
  "usa",
  "united kingdom",
  "uk",
  "canada",
  "australia",
  "singapore",
  "uae",
  "united arab emirates",
  "germany",
  "france",
  "china",
  "japan",
  "brazil",
];

const INDIAN_STATES = [
  "maharashtra",
  "karnataka",
  "tamil nadu",
  "kerala",
  "telangana",
  "andhra pradesh",
  "gujarat",
  "rajasthan",
  "uttar pradesh",
  "west bengal",
  "punjab",
  "haryana",
  "bihar",
  "madhya pradesh",
  "delhi",
  "goa",
];

const MAJOR_CITIES = [
  "bengaluru",
  "bangalore",
  "mumbai",
  "delhi",
  "chennai",
  "hyderabad",
  "pune",
  "kolkata",
  "ahmedabad",
  "jaipur",
  "surat",
  "lucknow",
  "new york",
  "london",
  "dubai",
  "san francisco",
  "singapore",
];

const GAZETTEER = new Set(
  [...COUNTRIES, ...INDIAN_STATES, ...MAJOR_CITIES].map((entry) => entry.toLowerCase()),
);

function looksLikeLocation(value: string): boolean {
  return GAZETTEER.has(value.trim().toLowerCase());
}

export const locationClassifier: FieldClassifier = {
  id: "location",
  fieldId: null,
  category: "pattern",
  classify(values: readonly string[]): ClassifierResult {
    return buildClassifierResult(values, looksLikeLocation);
  },
};
