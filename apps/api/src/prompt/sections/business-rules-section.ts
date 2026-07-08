import {
  buildBusinessRules,
  renderBusinessRules,
} from "@/prompt/business-rules/business-rule-builder";
import { DEFAULT_BUSINESS_RULE_PROFILE } from "@/prompt/business-rules/business-rule-profiles";
import { INJECTION_DEFENSE_STATEMENT } from "@/prompt/security/injection-defense";
import type { BusinessRuleProfile } from "@/prompt/business-rules/business-rule-types";

export function buildBusinessRulesSection(
  profile: BusinessRuleProfile = DEFAULT_BUSINESS_RULE_PROFILE,
): string {
  const rules = buildBusinessRules(profile);
  return ["# Business Rules", renderBusinessRules(rules), `- ${INJECTION_DEFENSE_STATEMENT}`].join(
    "\n",
  );
}
