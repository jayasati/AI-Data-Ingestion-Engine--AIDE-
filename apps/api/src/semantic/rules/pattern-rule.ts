import { SEMANTIC_FIELD_IDS, type SemanticFieldId } from "@/semantic/types";
import type { RuleContext, RuleSignal, SemanticRule } from "@/semantic/rules/rule-types";

const LOCATION_FIELDS: readonly SemanticFieldId[] = ["city", "state", "country"];

/**
 * Value Patterns source: heuristic (non-regex) classifiers — name, company,
 * status keywords/cardinality. Also where the location gazetteer's generic
 * "looks like a place" signal gets applied: it can't tell city from state
 * from country by itself, so it only reinforces whichever of those three the
 * header already hypothesized, rather than inventing a fresh candidate.
 */
export const patternRule: SemanticRule = {
  id: "value-patterns",
  category: "pattern",
  evaluate(context: RuleContext): readonly RuleSignal[] {
    const signals: RuleSignal[] = [];

    for (const fieldId of SEMANTIC_FIELD_IDS) {
      const result = context.column.patternSignals[fieldId];
      if (!result || result.matchRatio <= 0) {
        continue;
      }
      signals.push({
        fieldId,
        weight: result.matchRatio,
        source: "value-patterns",
        detail: `${Math.round(result.matchRatio * 100)}% of values in "${context.column.header}" match the ${fieldId} heuristic.`,
      });
    }

    const locationResult = context.column.locationSignal;
    if (locationResult.matchRatio > 0) {
      const hypothesizedLocationFields = new Set(
        context.header.candidates
          .map((candidate) => candidate.fieldId)
          .filter((fieldId): fieldId is SemanticFieldId => LOCATION_FIELDS.includes(fieldId)),
      );
      for (const fieldId of hypothesizedLocationFields) {
        signals.push({
          fieldId,
          weight: locationResult.matchRatio,
          source: "value-patterns",
          detail: `${Math.round(locationResult.matchRatio * 100)}% of values in "${context.column.header}" match known places, reinforcing ${fieldId}.`,
        });
      }
    }

    return signals;
  },
};
