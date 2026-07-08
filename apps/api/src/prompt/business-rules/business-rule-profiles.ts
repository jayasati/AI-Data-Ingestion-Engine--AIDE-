import { CRM_STATUS_VALUES, DATA_SOURCE_VALUES } from "@/ai/schema/crm-output-schema";
import type { BusinessRuleProfile } from "@/prompt/business-rules/business-rule-types";

/**
 * The assignment's actual rules (Volume 5's `buildBusinessRulesSection`),
 * now data instead of a hardcoded string — swapping in a different profile
 * (a future customer override) changes prompt behavior without touching
 * compiler code.
 */
export const DEFAULT_BUSINESS_RULE_PROFILE: BusinessRuleProfile = {
  id: "default",
  allowedCrmStatusValues: CRM_STATUS_VALUES,
  allowedDataSourceValues: DATA_SOURCE_VALUES,
  multipleEmailsRule:
    'If a row has more than one email, use the first as the "email" value and append the rest to "crm_note" instead of dropping them.',
  multiplePhonesRule:
    'If a row has more than one phone number, use the first as the phone value and append the rest to "crm_note" instead of dropping them.',
  dateRule: '"created_at" must be a value parseable by a standard date parser, or null.',
  skipRule:
    "Records with neither an email nor a phone number are still extracted here; skipping them is a downstream business-rule decision, not this stage's job.",
  crmNoteRule:
    '"crm_note" accumulates overflow contact details and any free-text remarks found in the row — never fabricate content that is not present in the row.',
  nullHandlingRule:
    "Never omit a field. Every one of the 15 output fields must be present on every record; use null when a value cannot be determined.",
};

const PROFILES_BY_ID: Readonly<Record<string, BusinessRuleProfile>> = {
  default: DEFAULT_BUSINESS_RULE_PROFILE,
};

export function getBusinessRuleProfile(id: string): BusinessRuleProfile | undefined {
  return PROFILES_BY_ID[id];
}
