import { SEMANTIC_FIELD_IDS } from "@/semantic/types";
import type { RuleContext, RuleSignal, SemanticRule } from "@/semantic/rules/rule-types";

/**
 * Regex Matches source: strong, header-independent evidence from Column
 * Intelligence's regex-backed classifiers (email/phone/date). This is what
 * lets a header like "Contact" resolve correctly from its values alone, even
 * when the header text itself gave no useful hint.
 */
export const regexRule: SemanticRule = {
  id: "regex-matches",
  category: "regex",
  evaluate(context: RuleContext): readonly RuleSignal[] {
    const signals: RuleSignal[] = [];
    for (const fieldId of SEMANTIC_FIELD_IDS) {
      const result = context.column.regexSignals[fieldId];
      if (!result || result.matchRatio <= 0) {
        continue;
      }
      signals.push({
        fieldId,
        weight: result.matchRatio,
        source: "regex-matches",
        detail: `${Math.round(result.matchRatio * 100)}% of values in "${context.column.header}" match the ${fieldId} pattern.`,
      });
    }
    return signals;
  },
};
