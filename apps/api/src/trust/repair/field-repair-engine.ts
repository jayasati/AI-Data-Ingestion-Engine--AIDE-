import { CRM_STATUS_VALUES, DATA_SOURCE_VALUES } from "@/ai/schema/crm-output-schema";
import { DateRule } from "@/pipeline/stages/normalization/rules/date-rule";
import { EmailRule } from "@/pipeline/stages/normalization/rules/email-rule";
import type { RepairAction } from "@/pipeline/domain/validation";
import { MULTI_VALUE_SPLIT_PATTERN } from "@/trust/business/business-rule-validator";
import { DEFAULT_TRUST_CONFIG, type TrustConfig } from "@/trust/config/trust-config";

export interface FieldRepairOutcome {
  readonly value: string | null;
  readonly action: RepairAction | null;
}

const dateRule = new DateRule();
const emailRule = new EmailRule();

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i++) distances[i][0] = i;
  for (let j = 0; j < cols; j++) distances[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      distances[i][j] =
        a[i - 1] === b[j - 1]
          ? distances[i - 1][j - 1]
          : 1 + Math.min(distances[i - 1][j - 1], distances[i - 1][j], distances[i][j - 1]);
    }
  }
  return distances[rows - 1][cols - 1];
}

function closestEnumValue(
  value: string,
  allowed: readonly string[],
  maxDistance: number,
): string | null {
  // Compare case-insensitively regardless of the target enum's own casing
  // (CRM_STATUS_VALUES is upper snake_case, DATA_SOURCE_VALUES is lower
  // snake_case) — `best` still returns the candidate's real, correct casing.
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  let best: string | null = null;
  let bestDistance = Infinity;

  for (const candidate of allowed) {
    const distance = levenshteinDistance(normalized, candidate.toLowerCase());
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  // Reaching here means `value` already failed an exact-match check against
  // `allowed`, so a normalized distance of 0 (a pure case/separator
  // mismatch, e.g. "good_lead_follow_up" vs "GOOD_LEAD_FOLLOW_UP") is
  // itself a genuine, worth-applying repair — not excluded as a no-op.
  return best !== null && bestDistance <= maxDistance ? best : null;
}

function repairAction(
  field: string,
  kind: RepairAction["kind"],
  originalValue: string,
  repairedValue: string | null,
  reason: string,
): RepairAction {
  return { field, kind, originalValue, repairedValue, reason };
}

/** Strips formatting noise (spaces, dashes, parens) without invoking international parsing — `mobile_without_country_code` must stay exactly that, never gain a country prefix. */
function stripPhoneFormatting(value: string): string {
  return value.replace(/[^\d]/g, "");
}

/**
 * Applies exactly one deterministic repair strategy per field, per the
 * assignment's list: invalid enum -> closest valid value, whitespace -> trim,
 * email/phone/date -> normalize, everything else left untouched. Never
 * invents data: a `null` value is always returned unchanged, and a
 * multi-value field (comma/semicolon-separated) is left alone rather than
 * guessed at — `business-rule-validator.ts` already flags that case, and
 * splitting it correctly would mean writing to a second field
 * (`crm_note`), which is outside a single-field repair's scope.
 */
export function repairField(
  field: string,
  value: string | null,
  config: TrustConfig = DEFAULT_TRUST_CONFIG,
): FieldRepairOutcome {
  if (value === null) {
    return { value: null, action: null };
  }

  if (field === "crm_status" && !(CRM_STATUS_VALUES as readonly string[]).includes(value)) {
    const closest = closestEnumValue(value, CRM_STATUS_VALUES, config.enumRepairMaxEditDistance);
    if (closest) {
      return {
        value: closest,
        action: repairAction(
          field,
          "enum_closest_match",
          value,
          closest,
          `"${value}" is not an allowed crm_status value; repaired to the closest match "${closest}".`,
        ),
      };
    }
  }

  if (field === "data_source" && !(DATA_SOURCE_VALUES as readonly string[]).includes(value)) {
    const closest = closestEnumValue(value, DATA_SOURCE_VALUES, config.enumRepairMaxEditDistance);
    if (closest) {
      return {
        value: closest,
        action: repairAction(
          field,
          "enum_closest_match",
          value,
          closest,
          `"${value}" is not an allowed data_source value; repaired to the closest match "${closest}".`,
        ),
      };
    }
  }

  if (field === "email" && !MULTI_VALUE_SPLIT_PATTERN.test(value)) {
    const outcome = emailRule.apply(value);
    if (outcome.value !== null && outcome.value !== value) {
      return {
        value: outcome.value,
        action: repairAction(
          field,
          "normalize_email",
          value,
          outcome.value,
          "Normalized email casing/whitespace.",
        ),
      };
    }
  }

  if (field === "mobile_without_country_code" && !MULTI_VALUE_SPLIT_PATTERN.test(value)) {
    const digitsOnly = stripPhoneFormatting(value);
    if (digitsOnly.length > 0 && digitsOnly !== value) {
      return {
        value: digitsOnly,
        action: repairAction(
          field,
          "normalize_phone",
          value,
          digitsOnly,
          "Stripped non-digit formatting from the phone number.",
        ),
      };
    }
  }

  if (field === "created_at") {
    const outcome = dateRule.apply(value);
    if (outcome.value !== null && outcome.value !== value) {
      return {
        value: outcome.value,
        action: repairAction(
          field,
          "normalize_date",
          value,
          outcome.value,
          "Normalized date to ISO 8601 (YYYY-MM-DD).",
        ),
      };
    }
  }

  const trimmed = value.trim();
  if (trimmed !== value) {
    return {
      value: trimmed,
      action: repairAction(
        field,
        "trim_whitespace",
        value,
        trimmed,
        "Trimmed leading/trailing whitespace.",
      ),
    };
  }

  return { value, action: null };
}
