import { normalizeHeaderName } from "@/pipeline/ingestion/header-engine";
import { SemanticKnowledgeBase, type KnowledgeMatchType } from "@/semantic/knowledge-base";
import { DEFAULT_SEMANTIC_CONFIG, type SemanticConfig } from "@/semantic/config/semantic-config";
import type { SemanticFieldId } from "@/semantic/types";

export interface HeaderCandidate {
  readonly fieldId: SemanticFieldId;
  readonly score: number;
  readonly matchType: KnowledgeMatchType;
}

/**
 * Header Intelligence's output: hypotheses only, never a CRM mapping. A
 * header like "Customer Name" or "Buyer" becomes a ranked list of candidate
 * fields — Column Intelligence and the Confidence Engine decide, downstream,
 * whether the data backs the hypothesis up.
 */
export interface HeaderSemanticProfile {
  readonly columnIndex: number;
  readonly originalHeader: string;
  readonly normalizedHeader: string;
  readonly candidates: readonly HeaderCandidate[];
  /** True when the top two candidates are too close in score to prefer one over the other. */
  readonly isAmbiguous: boolean;
}

export function analyzeHeaders(
  headers: readonly string[],
  knowledgeBase: SemanticKnowledgeBase = new SemanticKnowledgeBase(),
  config: SemanticConfig = DEFAULT_SEMANTIC_CONFIG,
): readonly HeaderSemanticProfile[] {
  return headers.map((originalHeader, columnIndex) => {
    const normalizedHeader = normalizeHeaderName(originalHeader);
    const candidates: readonly HeaderCandidate[] = knowledgeBase
      .match(normalizedHeader)
      .map((match) => ({ fieldId: match.fieldId, score: match.score, matchType: match.matchType }));

    const isAmbiguous =
      candidates.length >= 2 && candidates[0].score - candidates[1].score < config.ambiguityMargin;

    return { columnIndex, originalHeader, normalizedHeader, candidates, isAmbiguous };
  });
}
