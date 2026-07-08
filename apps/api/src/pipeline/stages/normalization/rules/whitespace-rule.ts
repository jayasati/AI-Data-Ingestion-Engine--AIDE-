import type {
  NormalizationRule,
  NormalizationRuleOutcome,
} from "@/pipeline/stages/normalization/rules/normalization-rule";
import {
  trimAndCollapseWhitespace,
  unifyLineBreaks,
} from "@/pipeline/stages/normalization/whitespace-normalizer";

const RULE_ID = "whitespace";

/** Always applies: trims, collapses runs of spaces/tabs, unifies line breaks to \n. */
export class WhitespaceRule implements NormalizationRule {
  readonly id = RULE_ID;

  canApply(): boolean {
    return true;
  }

  apply(value: string): NormalizationRuleOutcome {
    const normalized = trimAndCollapseWhitespace(unifyLineBreaks(value));
    return { value: normalized, changed: normalized !== value };
  }
}
