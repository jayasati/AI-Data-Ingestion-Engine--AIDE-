import { DEFAULT_BUSINESS_RULE_PROFILE } from "@/prompt/business-rules/business-rule-profiles";
import type {
  BusinessRule,
  BusinessRuleProfile,
} from "@/prompt/business-rules/business-rule-types";

/**
 * Turns a `BusinessRuleProfile` into the individual, independently
 * inspectable rules the spec names: Allowed CRM Status, Allowed Data
 * Sources, Multiple Emails, Multiple Phones, Date Rules, Skip Rules, CRM
 * Note Rules, Null Handling. A profile swap (e.g. a customer with a
 * different status vocabulary) changes every rule's text without this
 * function changing at all.
 */
export function buildBusinessRules(
  profile: BusinessRuleProfile = DEFAULT_BUSINESS_RULE_PROFILE,
): readonly BusinessRule[] {
  return [
    {
      id: "allowed_crm_status",
      text: `"crm_status" must be exactly one of: ${profile.allowedCrmStatusValues.join(", ")}, or null if none clearly applies.`,
    },
    {
      id: "allowed_data_source",
      text: `"data_source" must be exactly one of: ${profile.allowedDataSourceValues.join(", ")}, or null if none clearly applies.`,
    },
    { id: "date_rule", text: profile.dateRule },
    { id: "multiple_emails", text: profile.multipleEmailsRule },
    { id: "multiple_phones", text: profile.multiplePhonesRule },
    { id: "skip_rule", text: profile.skipRule },
    { id: "crm_note_rule", text: profile.crmNoteRule },
    { id: "null_handling", text: profile.nullHandlingRule },
  ];
}

export function renderBusinessRules(rules: readonly BusinessRule[]): string {
  return rules.map((rule) => `- ${rule.text}`).join("\n");
}
