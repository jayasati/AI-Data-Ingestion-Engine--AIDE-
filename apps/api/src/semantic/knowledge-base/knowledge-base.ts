import { AliasRegistry } from "@/semantic/knowledge-base/alias-registry";
import {
  SEMANTIC_CLUSTERS,
  type SemanticCluster,
} from "@/semantic/knowledge-base/semantic-clusters";
import { diceCoefficient } from "@/semantic/knowledge-base/text-similarity";
import { DEFAULT_SEMANTIC_CONFIG, type SemanticConfig } from "@/semantic/config/semantic-config";
import type { SemanticFieldId } from "@/semantic/types";

export type KnowledgeMatchType = "exact_alias" | "fuzzy";

export interface KnowledgeMatch {
  readonly fieldId: SemanticFieldId;
  readonly score: number;
  readonly matchType: KnowledgeMatchType;
  readonly matchedAlias: string;
}

/**
 * The semantic dictionary's single query surface: given an already-normalized
 * header, return every cluster it could plausibly belong to, exact matches
 * first. Exact and fuzzy matches for the *same* field never both appear —
 * fuzzy is a fallback for headers with no literal alias hit, not a booster
 * on top of one.
 */
export class SemanticKnowledgeBase {
  private readonly aliasRegistry: AliasRegistry;

  constructor(
    private readonly clusters: readonly SemanticCluster[] = SEMANTIC_CLUSTERS,
    private readonly config: SemanticConfig = DEFAULT_SEMANTIC_CONFIG,
    aliasRegistry?: AliasRegistry,
  ) {
    this.aliasRegistry = aliasRegistry ?? new AliasRegistry(clusters);
  }

  registerCustomAlias(alias: string, fieldId: SemanticFieldId): void {
    this.aliasRegistry.register(alias, fieldId, "custom");
  }

  clusterFor(fieldId: SemanticFieldId): SemanticCluster | undefined {
    return this.clusters.find((cluster) => cluster.fieldId === fieldId);
  }

  match(normalizedHeader: string): readonly KnowledgeMatch[] {
    const exact = this.aliasRegistry.lookup(normalizedHeader);
    if (exact.length > 0) {
      return exact.map((entry) => ({
        fieldId: entry.fieldId,
        score: 1,
        matchType: "exact_alias" as const,
        matchedAlias: entry.normalizedAlias,
      }));
    }

    return this.fuzzyMatch(normalizedHeader);
  }

  private fuzzyMatch(normalizedHeader: string): readonly KnowledgeMatch[] {
    const bestByField = new Map<SemanticFieldId, KnowledgeMatch>();

    for (const entry of this.aliasRegistry.allAliases()) {
      const score = diceCoefficient(normalizedHeader, entry.normalizedAlias);
      if (score < this.config.fuzzyMatchThreshold) {
        continue;
      }
      const current = bestByField.get(entry.fieldId);
      if (!current || score > current.score) {
        bestByField.set(entry.fieldId, {
          fieldId: entry.fieldId,
          score,
          matchType: "fuzzy",
          matchedAlias: entry.normalizedAlias,
        });
      }
    }

    return [...bestByField.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxFuzzyMatchesPerHeader);
  }
}
