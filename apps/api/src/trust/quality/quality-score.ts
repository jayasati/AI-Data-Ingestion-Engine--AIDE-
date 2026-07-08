import { DEFAULT_TRUST_CONFIG, type TrustConfig } from "@/trust/config/trust-config";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * A real CRM CSV routinely only ever has 4-5 of the 15 canonical fields
 * (name/email/phone/status is a common minimum) — every one of those
 * missing fields is legitimate, business-rule-sanctioned nulls, not a
 * defect. Uncapped, `missingFieldCount * weights.missingFields` would push
 * every sparse-but-perfectly-correct import below the approval threshold
 * forever, contradicting the same "don't punish sparsity" reasoning
 * `confidence-engine.ts` already applies to record confidence. Capping how
 * many missing fields count against the score keeps completeness a *minor*
 * quality signal, never a dominant one.
 */
const MAX_PENALIZED_MISSING_FIELDS = 6;

export interface QualityScoreInput {
  readonly missingFieldCount: number;
  readonly repairCount: number;
  readonly recordConfidence: number;
  /** The extraction's own average confidence over present fields — a Semantic Intelligence / LLM-quality signal, distinct from `recordConfidence` (which already carries Trust Layer penalties). */
  readonly semanticMatchAverage: number;
  readonly businessRuleViolationCount: number;
  readonly validationErrorCount: number;
}

/**
 * 0-100. Two-stage: a penalty-based raw score (100 minus per-unit
 * deductions for missing fields, repairs, business-rule violations, and
 * validation errors) is then scaled by a confidence factor — the weighted
 * average of `recordConfidence` and `semanticMatchAverage` — so a
 * structurally clean record the pipeline still isn't confident about can't
 * score as high as one that is both clean AND well-understood.
 */
export function computeQualityScore(
  input: QualityScoreInput,
  config: TrustConfig = DEFAULT_TRUST_CONFIG,
): number {
  const weights = config.qualityScoreWeights;

  const rawScore = clamp(
    100 -
      Math.min(input.missingFieldCount, MAX_PENALIZED_MISSING_FIELDS) * weights.missingFields -
      input.repairCount * weights.repairs -
      input.businessRuleViolationCount * weights.businessRuleViolations -
      input.validationErrorCount * weights.validationErrors,
    0,
    100,
  );

  const confidenceWeightTotal = weights.confidence + weights.semanticMatch;
  const confidenceFactor =
    confidenceWeightTotal > 0
      ? clamp(
          (input.recordConfidence * weights.confidence +
            input.semanticMatchAverage * weights.semanticMatch) /
            confidenceWeightTotal,
          0,
          1,
        )
      : 1;

  return Math.round(rawScore * confidenceFactor);
}
