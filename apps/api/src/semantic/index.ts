export { SEMANTIC_FIELD_IDS, type SemanticFieldId, type ConfidenceTier } from "@/semantic/types";
export {
  DEFAULT_SEMANTIC_CONFIG,
  resolveSemanticConfig,
  type SemanticConfig,
  type SemanticRuleWeights,
} from "@/semantic/config/semantic-config";
export {
  SEMANTIC_CLUSTERS,
  type SemanticCluster,
  diceCoefficient,
  AliasRegistry,
  type AliasEntry,
  type AliasSource,
  SemanticKnowledgeBase,
  type KnowledgeMatch,
  type KnowledgeMatchType,
} from "@/semantic/knowledge-base";
export {
  analyzeHeaders,
  type HeaderCandidate,
  type HeaderSemanticProfile,
} from "@/semantic/header-intelligence";
export {
  analyzeColumns,
  normalizedShannonEntropy,
  DEFAULT_CLASSIFIERS,
  type ClassifierResult,
  type ColumnSemanticProfile,
  type FieldClassifier,
} from "@/semantic/column-intelligence";
export {
  detectDatasetType,
  DATASET_TYPES,
  type DatasetType,
  type DatasetTypeResult,
  type DatasetTypeSignal,
} from "@/semantic/dataset-intelligence";
export {
  DEFAULT_RULES,
  headerRule,
  knowledgeRule,
  regexRule,
  patternRule,
  statisticalRule,
  historicalRule,
  type RuleCategory,
  type RuleContext,
  type RuleSignal,
  type SemanticRule,
} from "@/semantic/rules";
export {
  computeHeaderConfidence,
  type ConfidenceEvidence,
  type FieldCandidate,
  type HeaderConfidenceProfile,
} from "@/semantic/confidence";
export { mapFields, type HybridMappingEntry } from "@/semantic/mapping";
export { buildSemanticReport, type SemanticReport } from "@/semantic/report";
export {
  buildSemanticContext,
  type SemanticColumnContext,
  type SemanticDatasetContext,
  type SemanticFieldHint,
} from "@/semantic/context";
export {
  analyzeSemantics,
  type SemanticAnalysisResult,
  type SemanticEngineOptions,
} from "@/semantic/semantic-engine";
