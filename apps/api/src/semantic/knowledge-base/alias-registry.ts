import { normalizeHeaderName } from "@/pipeline/ingestion/header-engine";
import {
  SEMANTIC_CLUSTERS,
  type SemanticCluster,
} from "@/semantic/knowledge-base/semantic-clusters";
import type { SemanticFieldId } from "@/semantic/types";

export type AliasSource = "static" | "custom";

export interface AliasEntry {
  readonly normalizedAlias: string;
  readonly fieldId: SemanticFieldId;
  readonly source: AliasSource;
}

/**
 * Configurable registry of header spelling -> target field. Seeded from the
 * static `SEMANTIC_CLUSTERS` dictionary, but never hardcodes aliases into
 * matching logic — `register` is the only way new spellings enter the
 * registry, so per-customer or learned aliases (a later volume) plug in the
 * same way static ones do. Reuses `normalizeHeaderName` (Volume 3's header
 * engine) rather than re-inventing slugging, so "Email Address" and
 * "email-address" always collapse to the same lookup key everywhere.
 */
export class AliasRegistry {
  private readonly entriesByAlias = new Map<string, AliasEntry[]>();

  constructor(seedClusters: readonly SemanticCluster[] = SEMANTIC_CLUSTERS) {
    for (const cluster of seedClusters) {
      for (const alias of cluster.aliases) {
        this.register(alias, cluster.fieldId, "static");
      }
    }
  }

  register(alias: string, fieldId: SemanticFieldId, source: AliasSource = "custom"): void {
    const normalizedAlias = normalizeHeaderName(alias);
    const existing = this.entriesByAlias.get(normalizedAlias) ?? [];
    if (existing.some((entry) => entry.fieldId === fieldId)) {
      return;
    }
    this.entriesByAlias.set(normalizedAlias, [...existing, { normalizedAlias, fieldId, source }]);
  }

  lookup(normalizedHeader: string): readonly AliasEntry[] {
    return this.entriesByAlias.get(normalizedHeader) ?? [];
  }

  has(normalizedHeader: string): boolean {
    return this.entriesByAlias.has(normalizedHeader);
  }

  allAliases(): readonly AliasEntry[] {
    return [...this.entriesByAlias.values()].flat();
  }
}
