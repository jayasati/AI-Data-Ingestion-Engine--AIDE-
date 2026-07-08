import type {
  NormalizationRule,
  NormalizationRuleOutcome,
} from "@/pipeline/stages/normalization/rules/normalization-rule";

const RULE_ID = "location";
const WORD_BOUNDARY = /\s+/;

function titleCase(value: string): string {
  return value
    .split(WORD_BOUNDARY)
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(" ");
}

/**
 * Formatting only for fields already known to be Country/State/City — Title
 * Case plus whitespace cleanup. Never infers that a column IS a location:
 * there is no reliable per-cell signal distinguishing "Bangalore" (a place)
 * from any other short capitalized phrase without column context. `canApply`
 * therefore always returns false, so the default per-cell rule pipeline
 * never auto-triggers this rule. It exists as a complete, independently
 * tested module ready for a future column-aware orchestrator (once semantic
 * mapping identifies which columns are Country/State/City) to call `apply`
 * on directly.
 */
export class LocationRule implements NormalizationRule {
  readonly id = RULE_ID;

  canApply(): boolean {
    return false;
  }

  apply(value: string): NormalizationRuleOutcome {
    const normalized = titleCase(value.trim());
    return { value: normalized, changed: normalized !== value, confidence: 1 };
  }
}
