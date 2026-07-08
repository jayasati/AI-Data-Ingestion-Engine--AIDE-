/**
 * Every tunable knob in the Semantic Intelligence Engine lives here, as one
 * injectable object — knowledge base fuzzy matching, header ambiguity,
 * per-rule-category weighting, and hybrid-mapping thresholds. Every stage
 * that needs a knob takes it as an optional parameter defaulting to
 * `DEFAULT_SEMANTIC_CONFIG`, so a future customer override (or a benchmark
 * sweep) never has to touch matching logic itself.
 */
export interface SemanticRuleWeights {
  readonly header: number;
  readonly knowledge: number;
  readonly regex: number;
  readonly pattern: number;
  readonly historical: number;
}

export interface SemanticConfig {
  /** Minimum bigram-Dice similarity for a header to fuzzy-match a cluster alias. */
  readonly fuzzyMatchThreshold: number;
  /** Max fuzzy knowledge-base matches surfaced per header. */
  readonly maxFuzzyMatchesPerHeader: number;
  /** Two header candidates within this margin of each other count as ambiguous. */
  readonly ambiguityMargin: number;
  /** Multiplies each rule category's raw signal weight before noisy-OR aggregation. */
  readonly ruleWeights: SemanticRuleWeights;
  /** Scales how much a StatisticalRule signal can shift an already-established confidence. */
  readonly statisticalInfluence: number;
  /** Candidates below this normalized confidence are dropped from the report entirely. */
  readonly minReportedConfidence: number;
  /** Max ranked field candidates kept per header. */
  readonly maxCandidatesPerHeader: number;
  /** >= this confidence: Hybrid Mapper routes the header deterministically, no AI needed. */
  readonly highConfidenceThreshold: number;
  /** >= this confidence (and below high): AI receives ranked candidates as hints. */
  readonly mediumConfidenceThreshold: number;
  /** Column value match ratio above which a descriptive/classifier flag (likelyX) is set. */
  readonly classifierLikelyThreshold: number;
}

export const DEFAULT_SEMANTIC_CONFIG: SemanticConfig = {
  fuzzyMatchThreshold: 0.45,
  maxFuzzyMatchesPerHeader: 3,
  ambiguityMargin: 0.1,
  ruleWeights: {
    header: 0.85,
    knowledge: 0.97,
    regex: 1,
    pattern: 0.6,
    historical: 1,
  },
  statisticalInfluence: 0.2,
  minReportedConfidence: 0.05,
  maxCandidatesPerHeader: 5,
  highConfidenceThreshold: 0.85,
  mediumConfidenceThreshold: 0.4,
  classifierLikelyThreshold: 0.5,
};

export function resolveSemanticConfig(overrides?: Partial<SemanticConfig>): SemanticConfig {
  if (!overrides) {
    return DEFAULT_SEMANTIC_CONFIG;
  }
  return {
    ...DEFAULT_SEMANTIC_CONFIG,
    ...overrides,
    ruleWeights: { ...DEFAULT_SEMANTIC_CONFIG.ruleWeights, ...overrides.ruleWeights },
  };
}
