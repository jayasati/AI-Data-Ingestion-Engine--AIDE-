/**
 * Every tunable knob in the Trust Layer, as one injectable object — mirrors
 * `prompt/config/prompt-config.ts`'s pattern. Every engine that needs a
 * threshold takes it as an optional parameter defaulting to
 * `DEFAULT_TRUST_CONFIG`, so a future customer policy never touches
 * validation/repair/confidence/approval logic itself.
 */
export interface QualityScoreWeights {
  /** Penalty weight per missing field, up to `quality-score.ts`'s MAX_PENALIZED_MISSING_FIELDS cap — a thin-but-legitimate CSV (e.g. name/email/phone only) must not be structurally blocked from "approved". */
  readonly missingFields: number;
  /** Penalty weight per repair applied — a repaired record is trustworthy but not pristine. */
  readonly repairs: number;
  /** Weight given to the record's own confidence score. */
  readonly confidence: number;
  /** Penalty weight per business-rule violation. */
  readonly businessRuleViolations: number;
  /** Penalty weight per validation error (distinct from a warning). */
  readonly validationErrors: number;
  /** Weight given to the extraction's own semantic/field confidence average. */
  readonly semanticMatch: number;
}

export interface TrustConfig {
  /** Record confidence (0-1) at or above which a record is eligible for "approved". */
  readonly approvedConfidenceThreshold: number;
  /** Record confidence (0-1) at or above which a record is "needs_review" rather than "rejected". */
  readonly needsReviewConfidenceThreshold: number;
  /** Quality score (0-100) at or above which a record is eligible for "approved". */
  readonly approvedQualityThreshold: number;
  /** Quality score (0-100) at or above which a record is "needs_review" rather than "rejected". */
  readonly needsReviewQualityThreshold: number;
  /** A record with more repairs than this is capped at "needs_review", however high its confidence. */
  readonly maxRepairsBeforeReview: number;
  /** Max Levenshtein distance for the Repair Engine's enum closest-match (crm_status/data_source). */
  readonly enumRepairMaxEditDistance: number;
  /** Skip Engine: if true, a record with neither email nor phone is skipped. */
  readonly requireEmailOrPhone: boolean;
  readonly qualityScoreWeights: QualityScoreWeights;
}

export const DEFAULT_TRUST_CONFIG: TrustConfig = {
  approvedConfidenceThreshold: 0.75,
  needsReviewConfidenceThreshold: 0.4,
  approvedQualityThreshold: 70,
  needsReviewQualityThreshold: 40,
  maxRepairsBeforeReview: 3,
  enumRepairMaxEditDistance: 3,
  requireEmailOrPhone: true,
  qualityScoreWeights: {
    missingFields: 2,
    repairs: 4,
    confidence: 40,
    businessRuleViolations: 8,
    validationErrors: 10,
    semanticMatch: 20,
  },
};

export function resolveTrustConfig(overrides?: Partial<TrustConfig>): TrustConfig {
  if (!overrides) {
    return DEFAULT_TRUST_CONFIG;
  }
  return {
    ...DEFAULT_TRUST_CONFIG,
    ...overrides,
    qualityScoreWeights: {
      ...DEFAULT_TRUST_CONFIG.qualityScoreWeights,
      ...overrides.qualityScoreWeights,
    },
  };
}
