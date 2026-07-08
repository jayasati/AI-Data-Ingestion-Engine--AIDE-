import type { EmailFieldDetails } from "@/pipeline/domain/normalization";
import { looksLikeEmail } from "@/pipeline/ingestion/pattern-detectors";
import type {
  NormalizationRule,
  NormalizationRuleOutcome,
} from "@/pipeline/stages/normalization/rules/normalization-rule";

const RULE_ID = "email";
const SPLIT_PATTERN = /[;,]|\s+and\s+/i;
// Deliberately looser than looksLikeEmail: requires an "@" with non-space,
// non-"@" content on both sides, but not necessarily a valid domain/dot. If
// canApply used the strict check, a lone malformed attempt like "user@nodot"
// (no comma-separated valid sibling) would never reach this rule at all —
// canApply would be false, it would fall through to TextRule unchanged, and
// the value would never be flagged as an invalid email. This gate only
// decides "does this look like someone tried to write an email"; the strict
// check still gates `isValid` below.
const EMAIL_ATTEMPT_PATTERN = /^[^\s@]+@[^\s@]+$/;

function splitEmails(value: string): string[] {
  return value
    .split(SPLIT_PATTERN)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Trims, lowercases, validates syntax. Multiple emails in one cell (comma or
 * semicolon separated) keep the first as `primary`; the rest are carried in
 * `additional` for a future CRM-note step to append — this rule never drops data.
 */
export class EmailRule implements NormalizationRule {
  readonly id = RULE_ID;

  canApply(value: string): boolean {
    return splitEmails(value).some((part) => EMAIL_ATTEMPT_PATTERN.test(part));
  }

  apply(value: string): NormalizationRuleOutcome {
    const candidates = splitEmails(value).map((part) => part.toLowerCase());
    const [primary, ...additional] = candidates;
    const isValid = looksLikeEmail(primary);

    const details: EmailFieldDetails = { kind: "email", primary, additional, isValid };

    return {
      value: primary,
      changed: primary !== value,
      details,
      confidence: isValid ? 1 : 0.4,
      warnings: isValid
        ? undefined
        : [
            {
              code: "INVALID_EMAIL_SYNTAX",
              message: `"${primary}" does not look like a valid email address.`,
            },
          ],
    };
  }
}
