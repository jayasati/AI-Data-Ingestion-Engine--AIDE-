import type { ExtractedRecord } from "@/pipeline/domain/extraction";
import type { SkipDecision } from "@/pipeline/domain/validation";
import { DEFAULT_TRUST_CONFIG, type TrustConfig } from "@/trust/config/trust-config";

function valueOf(record: ExtractedRecord, field: string): string | null {
  return record.fields.find((f) => f.targetField === field)?.value ?? null;
}

function hasContent(value: string | null): boolean {
  return value !== null && value.trim().length > 0;
}

/**
 * The downstream half of `business-rule-profiles.ts`'s deferred skip rule:
 * "records with neither an email nor a phone number are still extracted...
 * skipping them is a downstream business-rule decision, not [the extraction]
 * stage's job." This is that decision point. Runs before repair — a record
 * that's missing both contact fields is skipped regardless of how well
 * everything else validates.
 */
export function evaluateSkip(
  record: ExtractedRecord,
  config: TrustConfig = DEFAULT_TRUST_CONFIG,
): SkipDecision {
  if (!config.requireEmailOrPhone) {
    return { skipped: false, reason: null };
  }

  const hasEmail = hasContent(valueOf(record, "email"));
  const hasPhone = hasContent(valueOf(record, "mobile_without_country_code"));

  if (!hasEmail && !hasPhone) {
    return {
      skipped: true,
      reason:
        "Record has neither an email nor a phone number; skipped per the assignment's skip rule.",
    };
  }

  return { skipped: false, reason: null };
}
