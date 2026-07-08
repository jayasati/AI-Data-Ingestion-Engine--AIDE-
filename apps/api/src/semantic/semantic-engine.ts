import type { NormalizedDataset } from "@/pipeline/domain/normalization";
import {
  analyzeColumns,
  DEFAULT_CLASSIFIERS,
  type ColumnSemanticProfile,
  type FieldClassifier,
} from "@/semantic/column-intelligence";
import {
  computeHeaderConfidence,
  type HeaderConfidenceProfile,
} from "@/semantic/confidence/confidence-engine";
import {
  DEFAULT_SEMANTIC_CONFIG,
  resolveSemanticConfig,
  type SemanticConfig,
} from "@/semantic/config/semantic-config";
import {
  detectDatasetType,
  type DatasetTypeResult,
} from "@/semantic/dataset-intelligence/dataset-type-detector";
import {
  analyzeHeaders,
  type HeaderSemanticProfile,
} from "@/semantic/header-intelligence/header-analyzer";
import { SemanticKnowledgeBase } from "@/semantic/knowledge-base/knowledge-base";
import { mapFields, type HybridMappingEntry } from "@/semantic/mapping/hybrid-mapper";
import {
  buildSemanticReport,
  type SemanticReport,
} from "@/semantic/report/semantic-report-builder";
import { DEFAULT_RULES } from "@/semantic/rules";
import type { SemanticRule } from "@/semantic/rules/rule-types";

export interface SemanticAnalysisResult {
  readonly headerProfiles: readonly HeaderSemanticProfile[];
  readonly columnProfiles: readonly ColumnSemanticProfile[];
  readonly datasetType: DatasetTypeResult;
  readonly confidenceProfiles: readonly HeaderConfidenceProfile[];
  readonly mappings: readonly HybridMappingEntry[];
  readonly report: SemanticReport;
}

export interface SemanticEngineOptions {
  readonly config?: Partial<SemanticConfig>;
  readonly knowledgeBase?: SemanticKnowledgeBase;
  readonly classifiers?: readonly FieldClassifier[];
  readonly rules?: readonly SemanticRule[];
}

/**
 * The Semantic Intelligence Engine's single entry point: Header Intelligence
 * -> Column Intelligence -> Dataset Intelligence -> Confidence Engine ->
 * Hybrid Mapping -> Semantic Report, over an already-normalized dataset. Pure
 * and stateless — nothing here is persisted or learned between calls (no
 * Semantic Memory this volume), so calling it twice on the same dataset
 * always returns the same result.
 */
export function analyzeSemantics(
  dataset: NormalizedDataset,
  options: SemanticEngineOptions = {},
): SemanticAnalysisResult {
  const config = options.config ? resolveSemanticConfig(options.config) : DEFAULT_SEMANTIC_CONFIG;
  const knowledgeBase = options.knowledgeBase ?? new SemanticKnowledgeBase(undefined, config);
  const classifiers = options.classifiers ?? DEFAULT_CLASSIFIERS;
  const rules = options.rules ?? DEFAULT_RULES;

  const headerProfiles = analyzeHeaders(dataset.headers, knowledgeBase, config);
  const columnProfiles = analyzeColumns(dataset, classifiers, config);
  const datasetType = detectDatasetType(headerProfiles.map((profile) => profile.normalizedHeader));

  const confidenceProfiles = headerProfiles.map((header, index) =>
    computeHeaderConfidence({ header, column: columnProfiles[index] }, rules, config),
  );
  const mappings = mapFields(confidenceProfiles, config);
  const report = buildSemanticReport(datasetType, mappings);

  return { headerProfiles, columnProfiles, datasetType, confidenceProfiles, mappings, report };
}
