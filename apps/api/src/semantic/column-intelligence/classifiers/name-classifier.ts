import {
  looksLikeDate,
  looksLikeEmail,
  looksLikeNumeric,
  looksLikePhone,
} from "@/pipeline/ingestion/pattern-detectors";
import {
  buildClassifierResult,
  type ClassifierResult,
  type FieldClassifier,
} from "@/semantic/column-intelligence/classifiers/classifier-types";

const NAME_SHAPE = /^[\p{L}][\p{L}'.-]*(?:\s+[\p{L}][\p{L}'.-]*){0,3}$/u;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 60;

/**
 * A necessarily small, curated blocklist — never exhaustive, same spirit as
 * the location gazetteer. `NAME_SHAPE` alone accepts any Title-Case
 * multi-word phrase, so a form/campaign/status column full of values like
 * "Site Visit Request" or "Brochure Download" was scoring as plausibly
 * `name` purely on capitalization shape. These are common English nouns
 * that turn up constantly in CRM/marketing/document column values but
 * essentially never as a token of a real person's name.
 */
const NON_NAME_WORDS = new Set([
  "request",
  "download",
  "visit",
  "brochure",
  "callback",
  "form",
  "interest",
  "inquiry",
  "enquiry",
  "info",
  "information",
  "details",
  "detail",
  "report",
  "summary",
  "update",
  "confirmation",
  "submission",
  "response",
  "feedback",
  "application",
  "registration",
  "subscription",
  "newsletter",
  "campaign",
  "promotion",
  "offer",
  "discount",
  "deal",
  "invoice",
  "receipt",
  "order",
  "payment",
  "booking",
  "appointment",
  "meeting",
  "demo",
  "webinar",
  "event",
  "session",
  "product",
  "service",
  "package",
  "template",
  "document",
  "attachment",
  "website",
  "page",
  "site",
  "source",
  "status",
  "note",
  "notes",
  "description",
]);

function containsNonNameWord(value: string): boolean {
  return value
    .trim()
    .split(/\s+/)
    .some((token) => NON_NAME_WORDS.has(token.toLowerCase()));
}

function looksLikeName(value: string): boolean {
  if (
    looksLikeEmail(value) ||
    looksLikePhone(value) ||
    looksLikeDate(value) ||
    looksLikeNumeric(value)
  ) {
    return false;
  }
  const trimmed = value.trim();
  return (
    trimmed.length >= MIN_NAME_LENGTH &&
    trimmed.length <= MAX_NAME_LENGTH &&
    NAME_SHAPE.test(trimmed) &&
    !containsNonNameWord(trimmed)
  );
}

export const nameClassifier: FieldClassifier = {
  id: "name",
  fieldId: "name",
  category: "pattern",
  classify(values: readonly string[]): ClassifierResult {
    return buildClassifierResult(values, looksLikeName);
  },
};
