import type {
  NormalizationRule,
  NormalizationRuleOutcome,
} from "@/pipeline/stages/normalization/rules/normalization-rule";
import { normalizeUnicode } from "@/pipeline/stages/normalization/unicode-normalizer";

const RULE_ID = "unicode";

/** Always applies: composed-form Unicode, no BOM/zero-width/control characters. */
export class UnicodeRule implements NormalizationRule {
  readonly id = RULE_ID;

  canApply(): boolean {
    return true;
  }

  apply(value: string): NormalizationRuleOutcome {
    const result = normalizeUnicode(value);
    return { value: result.value, changed: result.changed };
  }
}
