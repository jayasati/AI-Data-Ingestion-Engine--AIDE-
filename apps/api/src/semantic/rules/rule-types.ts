import type { ColumnSemanticProfile } from "@/semantic/column-intelligence/column-analyzer";
import type { HeaderSemanticProfile } from "@/semantic/header-intelligence/header-analyzer";
import type { SemanticFieldId } from "@/semantic/types";

export interface RuleContext {
  readonly header: HeaderSemanticProfile;
  readonly column: ColumnSemanticProfile;
}

/**
 * `weight` is in [-1, 1]: positive contributes supporting evidence toward
 * `fieldId`, negative (StatisticalRule only) refutes an already-hypothesized
 * field. Every other rule category only ever emits positive weights.
 */
export interface RuleSignal {
  readonly fieldId: SemanticFieldId;
  readonly weight: number;
  readonly source: string;
  readonly detail: string;
}

export type RuleCategory =
  "header" | "knowledge" | "regex" | "pattern" | "statistical" | "historical";

/**
 * One signal source feeding the Confidence Engine — Header Similarity,
 * Knowledge Base, Regex Matches, Value Patterns, Column Statistics, and a
 * Historical placeholder, matching the six sources the architecture calls
 * for. Each rule is a pure function of its `RuleContext` and independently
 * unit-testable without the engine around it.
 */
export interface SemanticRule {
  readonly id: string;
  readonly category: RuleCategory;
  evaluate(context: RuleContext): readonly RuleSignal[];
}
