import type { SemanticFieldId } from "@/semantic/types";
import type { RuleContext, RuleSignal, SemanticRule } from "@/semantic/rules/rule-types";

const EXPECTED_HIGH_UNIQUENESS: ReadonlySet<SemanticFieldId> = new Set([
  "name",
  "email",
  "phone",
  "description",
  "crm_note",
  "created_at",
]);

const EXPECTED_LOW_UNIQUENESS: ReadonlySet<SemanticFieldId> = new Set([
  "lead_owner",
  "crm_status",
  "data_source",
  "country",
  "state",
  "possession_time",
]);

const HIGH_UNIQUENESS_THRESHOLD = 0.6;
const LOW_UNIQUENESS_THRESHOLD = 0.5;
const ADJUSTMENT_MAGNITUDE = 1;
const MIN_SAMPLE_SIZE = 3;

/**
 * Column Statistics source — but a refiner, not a generator: it only
 * confirms or refutes fields the header/knowledge/value-pattern rules
 * already proposed, per Task 12.3 ("confirm or refute header hypotheses").
 * `weight` here is a signed adjustment consumed specially by the Confidence
 * Engine (see confidence/confidence-engine.ts), not a noisy-OR contribution.
 */
export const statisticalRule: SemanticRule = {
  id: "column-statistics",
  category: "statistical",
  evaluate(context: RuleContext): readonly RuleSignal[] {
    if (context.column.nonEmptyCount < MIN_SAMPLE_SIZE) {
      return [];
    }

    const signals: RuleSignal[] = [];
    const hypothesizedFields = new Set(
      context.header.candidates.map((candidate) => candidate.fieldId),
    );

    for (const fieldId of hypothesizedFields) {
      const expectation = EXPECTED_HIGH_UNIQUENESS.has(fieldId)
        ? "high"
        : EXPECTED_LOW_UNIQUENESS.has(fieldId)
          ? "low"
          : null;
      if (!expectation) {
        continue;
      }

      const ratio = context.column.uniquenessRatio;
      const confirms =
        expectation === "high"
          ? ratio >= HIGH_UNIQUENESS_THRESHOLD
          : ratio <= LOW_UNIQUENESS_THRESHOLD;

      signals.push({
        fieldId,
        weight: confirms ? ADJUSTMENT_MAGNITUDE : -ADJUSTMENT_MAGNITUDE,
        source: "column-statistics",
        detail: confirms
          ? `Uniqueness ratio ${ratio.toFixed(2)} in "${context.column.header}" matches the expected ${expectation}-cardinality profile for ${fieldId}.`
          : `Uniqueness ratio ${ratio.toFixed(2)} in "${context.column.header}" contradicts the expected ${expectation}-cardinality profile for ${fieldId}.`,
      });
    }

    return signals;
  },
};
