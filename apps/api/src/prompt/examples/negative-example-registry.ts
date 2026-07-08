/**
 * Known wrong mappings — shown to the AI so it doesn't repeat them. Per
 * Chapter 12/11's "Negative Example Library" idea: showing a failure is
 * often more corrective than another success example, because it directly
 * rules out a specific, plausible-looking confusion.
 */
export interface NegativeExample {
  readonly id: string;
  readonly sourceField: string;
  readonly incorrectTargetField: string;
  readonly explanation: string;
}

export const NEGATIVE_EXAMPLES: readonly NegativeExample[] = [
  {
    id: "company-to-lead-owner",
    sourceField: "Company",
    incorrectTargetField: "lead_owner",
    explanation:
      "A company name is the lead's employer/organization, never the salesperson assigned to the lead.",
  },
  {
    id: "phone-to-company",
    sourceField: "Phone",
    incorrectTargetField: "company",
    explanation: "A phone number is never a company name, even when the company column is empty.",
  },
  {
    id: "city-to-country",
    sourceField: "City",
    incorrectTargetField: "country",
    explanation:
      "City and country are different administrative levels — never collapse one into the other.",
  },
  {
    id: "status-to-data-source",
    sourceField: "Status",
    incorrectTargetField: "data_source",
    explanation:
      '"Status" describes the lead\'s current pipeline stage (e.g. follow-up needed), not where the lead originated.',
  },
  {
    id: "date-to-phone",
    sourceField: "Signup Date",
    incorrectTargetField: "mobile_without_country_code",
    explanation:
      'A dashed numeric date (e.g. "2026-01-15") is digits-and-punctuation like a phone number, but a date pattern always takes priority over a phone pattern.',
  },
  {
    id: "email-to-name",
    sourceField: "Email",
    incorrectTargetField: "name",
    explanation:
      "An email's local part often resembles a name, but the email value itself is never the name field.",
  },
];

/**
 * Deterministic slice of the curated set, not a scored selection — the
 * spec asks these to reduce systematic mistakes broadly, not to be tailored
 * per-dataset the way few-shot examples are.
 */
export function selectNegativeExamples(
  limit: number,
  examples: readonly NegativeExample[] = NEGATIVE_EXAMPLES,
): readonly NegativeExample[] {
  return examples.slice(0, Math.max(0, limit));
}
