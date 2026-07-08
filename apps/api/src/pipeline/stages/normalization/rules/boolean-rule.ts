import type { BooleanFieldDetails } from "@/pipeline/domain/normalization";
import type {
  NormalizationRule,
  NormalizationRuleOutcome,
} from "@/pipeline/stages/normalization/rules/normalization-rule";

const RULE_ID = "boolean";

const TRUE_ALIASES = new Set(["yes", "y", "true", "t"]);
const FALSE_ALIASES = new Set(["no", "n", "false", "f"]);

/**
 * Auto-detection deliberately excludes bare "0"/"1": those are numeric-
 * shaped, and the engine tries NumberRule before BooleanRule in its default
 * priority order, so a lone digit resolves to a number rather than a guessed
 * boolean — there is no column context here to disambiguate the two.
 */
export class BooleanRule implements NormalizationRule {
  readonly id = RULE_ID;

  canApply(value: string): boolean {
    const key = value.trim().toLowerCase();
    return TRUE_ALIASES.has(key) || FALSE_ALIASES.has(key);
  }

  apply(value: string): NormalizationRuleOutcome {
    const key = value.trim().toLowerCase();
    const boolValue = TRUE_ALIASES.has(key);
    const details: BooleanFieldDetails = { kind: "boolean", value: boolValue };
    const normalized = String(boolValue);
    return { value: normalized, changed: normalized !== value, details, confidence: 1 };
  }
}
