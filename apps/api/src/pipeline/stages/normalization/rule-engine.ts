import type { StageIssue } from "@/pipeline/contracts/stage-result";
import type {
  NormalizedField,
  NormalizedFieldDetails,
  NormalizationStatus,
} from "@/pipeline/domain/normalization";
import { BooleanRule } from "@/pipeline/stages/normalization/rules/boolean-rule";
import { DateRule } from "@/pipeline/stages/normalization/rules/date-rule";
import { EmailRule } from "@/pipeline/stages/normalization/rules/email-rule";
import type {
  NormalizationRule,
  NormalizationRuleContext,
} from "@/pipeline/stages/normalization/rules/normalization-rule";
import { NullRule } from "@/pipeline/stages/normalization/rules/null-rule";
import { NumberRule } from "@/pipeline/stages/normalization/rules/number-rule";
import { PhoneRule } from "@/pipeline/stages/normalization/rules/phone-rule";
import { TextRule } from "@/pipeline/stages/normalization/rules/text-rule";
import { UnicodeRule } from "@/pipeline/stages/normalization/rules/unicode-rule";
import { WhitespaceRule } from "@/pipeline/stages/normalization/rules/whitespace-rule";

/**
 * Content-shape rules are mutually exclusive alternatives, tried in this
 * order — the first whose `canApply` matches wins, and no other content
 * rule runs on that value. Email/Phone/Date come before Number/Boolean
 * since their shapes are more specific (a phone number is also digit-heavy
 * but carries punctuation Number's pattern excludes). Number is checked
 * before Boolean so a bare "1"/"0" resolves to a number, not a guessed
 * boolean — see boolean-rule.ts.
 */
function defaultContentRules(): readonly NormalizationRule[] {
  return [new EmailRule(), new PhoneRule(), new DateRule(), new NumberRule(), new BooleanRule()];
}

export interface FieldNormalizationEngineOptions {
  readonly nullRule?: NullRule;
  readonly contentRules?: readonly NormalizationRule[];
}

/**
 * Runs one cell through the full rule pipeline: universal rules always run
 * (Unicode, then Whitespace), then Null (terminal if it matches), then at
 * most one content-shape rule, then Text as the fallback for anything left
 * unclaimed. A rule that throws is caught here — normalization failures
 * must never stop the pipeline (see NormalizationStage) — and recorded as a
 * "failed" field with the original value preserved.
 */
export class FieldNormalizationEngine {
  // Typed against the interface (not the concrete class) so calls use the
  // interface's 2-parameter signature — most rules omit the unused
  // `context` parameter in their own declarations for brevity.
  private readonly unicodeRule: NormalizationRule = new UnicodeRule();
  private readonly whitespaceRule: NormalizationRule = new WhitespaceRule();
  private readonly nullRule: NormalizationRule;
  private readonly contentRules: readonly NormalizationRule[];
  private readonly textRule: NormalizationRule = new TextRule();

  constructor(options: FieldNormalizationEngineOptions = {}) {
    this.nullRule = options.nullRule ?? new NullRule();
    this.contentRules = options.contentRules ?? defaultContentRules();
  }

  normalizeValue(rawValue: string, context: NormalizationRuleContext): NormalizedField {
    const appliedRules: string[] = [];

    try {
      const unicodeOutcome = this.unicodeRule.apply(rawValue, context);
      let current = unicodeOutcome.value ?? rawValue;
      if (unicodeOutcome.changed) {
        appliedRules.push(this.unicodeRule.id);
      }

      const whitespaceOutcome = this.whitespaceRule.apply(current, context);
      current = whitespaceOutcome.value ?? current;
      if (whitespaceOutcome.changed) {
        appliedRules.push(this.whitespaceRule.id);
      }

      if (this.nullRule.canApply(current, context)) {
        appliedRules.push(this.nullRule.id);
        return this.buildField(context.header, rawValue, null, appliedRules, [], "normalized", 1);
      }

      const contentRule = this.contentRules.find((rule) => rule.canApply(current, context));
      if (contentRule) {
        const outcome = contentRule.apply(current, context);
        appliedRules.push(contentRule.id);
        const warnings = outcome.warnings ?? [];
        const status: NormalizationStatus = warnings.length > 0 ? "warning" : "normalized";
        return this.buildField(
          context.header,
          rawValue,
          outcome.value,
          appliedRules,
          warnings,
          status,
          outcome.confidence ?? 1,
          outcome.details,
        );
      }

      const textOutcome = this.textRule.apply(current, context);
      current = textOutcome.value ?? current;
      if (textOutcome.changed) {
        appliedRules.push(this.textRule.id);
      }

      const status: NormalizationStatus = appliedRules.length > 0 ? "normalized" : "unchanged";
      return this.buildField(context.header, rawValue, current, appliedRules, [], status, 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.buildField(
        context.header,
        rawValue,
        rawValue,
        appliedRules,
        [{ code: "NORMALIZATION_RULE_ERROR", message }],
        "failed",
        0,
      );
    }
  }

  private buildField(
    header: string,
    originalValue: string,
    normalizedValue: string | null,
    appliedRules: readonly string[],
    warnings: readonly StageIssue[],
    status: NormalizationStatus,
    confidence: number,
    details?: NormalizedFieldDetails,
  ): NormalizedField {
    return {
      header,
      originalValue,
      normalizedValue,
      appliedRules,
      warnings,
      status,
      confidence,
      details,
    };
  }
}
