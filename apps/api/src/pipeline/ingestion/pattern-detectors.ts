/**
 * Deterministic, regex-only pattern detectors. Never AI, never a CRM field
 * mapping — these only answer "does this value look like an email/phone/
 * date/number", used to build hints for the Column Profiler.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}([T ].*)?$/, // 2026-05-12, 2026-05-12T00:00:00Z
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // 5/12/2026, 12/05/26
  /^\d{1,2}-\d{1,2}-\d{2,4}$/, // 5-12-2026
  /^\d{1,2}\.\d{1,2}\.\d{2,4}$/, // 12.05.2026
];

const PHONE_ALLOWED_CHARS = /^[+()\-.\s\d]+$/;
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;

export function looksLikeEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

export function looksLikeDate(value: string): boolean {
  return DATE_PATTERNS.some((pattern) => pattern.test(value));
}

export function looksLikePhone(value: string): boolean {
  // A dashed ISO-ish date (e.g. "2026-01-15") is also digits-and-dashes and
  // would otherwise satisfy the phone shape below; date is the more specific,
  // more useful classification, so it takes priority.
  if (looksLikeDate(value)) {
    return false;
  }
  if (!PHONE_ALLOWED_CHARS.test(value)) {
    return false;
  }
  const digitCount = (value.match(/\d/g) ?? []).length;
  return digitCount >= MIN_PHONE_DIGITS && digitCount <= MAX_PHONE_DIGITS;
}

export function looksLikeNumeric(value: string): boolean {
  const withoutCurrencyAndPercent = value.replace(/^[+-]?\$/, "").replace(/%$/, "");
  const withoutThousandsSeparators = withoutCurrencyAndPercent.replace(/,/g, "");
  if (withoutThousandsSeparators.length === 0) {
    return false;
  }
  return /^[+-]?\d+(\.\d+)?$/.test(withoutThousandsSeparators);
}
