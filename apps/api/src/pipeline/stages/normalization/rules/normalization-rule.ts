import type { StageIssue } from "@/pipeline/contracts/stage-result";
import type { NormalizedFieldDetails } from "@/pipeline/domain/normalization";

/** Reserved for future column-aware rules (e.g. Location, once semantic mapping exists); unused today. */
export interface NormalizationRuleContext {
  readonly header: string;
  readonly columnIndex: number;
}

export interface NormalizationRuleOutcome {
  readonly value: string | null;
  readonly changed: boolean;
  readonly warnings?: readonly StageIssue[];
  readonly details?: NormalizedFieldDetails;
  /** Only content-shape rules set this; universal rules are always fully confident. */
  readonly confidence?: number;
  /** True when nothing further should run (only NullRule uses this today). */
  readonly terminal?: boolean;
}

/**
 * Common contract every normalization rule implements, so each is
 * independently constructible and testable and the engine can treat them
 * uniformly. `canApply` gates whether a rule is relevant to a given value;
 * `apply` performs the transformation.
 */
export interface NormalizationRule {
  readonly id: string;
  canApply(value: string, context: NormalizationRuleContext): boolean;
  apply(value: string, context: NormalizationRuleContext): NormalizationRuleOutcome;
}
