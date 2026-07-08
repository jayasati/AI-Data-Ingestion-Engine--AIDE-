import { describe, expect, it } from "vitest";
import {
  buildBusinessRules,
  renderBusinessRules,
} from "@/prompt/business-rules/business-rule-builder";
import { DEFAULT_BUSINESS_RULE_PROFILE } from "@/prompt/business-rules/business-rule-profiles";
import type { BusinessRuleProfile } from "@/prompt/business-rules/business-rule-types";

describe("buildBusinessRules", () => {
  it("produces all 8 named rule categories from the default profile", () => {
    const rules = buildBusinessRules();
    expect(rules.map((r) => r.id)).toEqual([
      "allowed_crm_status",
      "allowed_data_source",
      "date_rule",
      "multiple_emails",
      "multiple_phones",
      "skip_rule",
      "crm_note_rule",
      "null_handling",
    ]);
  });

  it("interpolates the profile's allowed enum values", () => {
    const rules = buildBusinessRules(DEFAULT_BUSINESS_RULE_PROFILE);
    const statusRule = rules.find((r) => r.id === "allowed_crm_status");
    for (const status of DEFAULT_BUSINESS_RULE_PROFILE.allowedCrmStatusValues) {
      expect(statusRule?.text).toContain(status);
    }
  });

  it("is fully driven by a custom profile — a different profile changes the rendered text", () => {
    const customProfile: BusinessRuleProfile = {
      ...DEFAULT_BUSINESS_RULE_PROFILE,
      id: "custom",
      allowedCrmStatusValues: ["OPEN", "CLOSED"],
      skipRule: "Custom skip rule text.",
    };
    const rules = buildBusinessRules(customProfile);
    expect(rules.find((r) => r.id === "allowed_crm_status")?.text).toContain("OPEN, CLOSED");
    expect(rules.find((r) => r.id === "skip_rule")?.text).toBe("Custom skip rule text.");
  });
});

describe("renderBusinessRules", () => {
  it("renders each rule as a markdown bullet, one per line", () => {
    const rendered = renderBusinessRules(buildBusinessRules());
    const lines = rendered.split("\n");
    expect(lines).toHaveLength(8);
    for (const line of lines) {
      expect(line.startsWith("- ")).toBe(true);
    }
  });
});
