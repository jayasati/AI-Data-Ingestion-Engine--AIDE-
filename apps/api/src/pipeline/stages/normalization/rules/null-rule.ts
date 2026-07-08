import {
  DEFAULT_NULL_ALIASES,
  isEmptyToken,
} from "@/pipeline/stages/normalization/empty-token-detector";
import type {
  NormalizationRule,
  NormalizationRuleOutcome,
} from "@/pipeline/stages/normalization/rules/normalization-rule";

const RULE_ID = "null";

/** Terminal: once a value matches a configured null-alias, nothing further needs normalizing. */
export class NullRule implements NormalizationRule {
  readonly id = RULE_ID;

  constructor(private readonly aliases: ReadonlySet<string> = DEFAULT_NULL_ALIASES) {}

  canApply(value: string): boolean {
    return isEmptyToken(value, this.aliases);
  }

  apply(): NormalizationRuleOutcome {
    return { value: null, changed: true, terminal: true };
  }
}
