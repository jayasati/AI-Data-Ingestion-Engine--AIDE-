import type { DatasetTypeResult } from "@/semantic/dataset-intelligence/dataset-type-detector";
import type { HybridMappingEntry } from "@/semantic/mapping/hybrid-mapper";

export interface SemanticReport {
  readonly datasetType: DatasetTypeResult["detectedType"];
  readonly datasetTypeConfidence: number;
  readonly columnsAnalyzed: number;
  readonly highConfidenceFields: readonly HybridMappingEntry[];
  readonly mediumConfidenceFields: readonly HybridMappingEntry[];
  readonly aiRequiredFields: readonly HybridMappingEntry[];
  readonly unknownColumns: readonly HybridMappingEntry[];
  /** Fraction of columns routed to "deterministic" or "ai_candidate" — i.e. not left to guess cold. */
  readonly semanticCoverage: number;
  /** Mean top-candidate confidence across all columns (0 counted for "unknown"). */
  readonly averageConfidence: number;
}

/**
 * Rolls up the Hybrid Mapper's per-column decisions into the one summary a
 * human (or the preview UI) actually wants: what kind of dataset this looks
 * like, and how much of it the engine already understands without AI.
 */
export function buildSemanticReport(
  datasetType: DatasetTypeResult,
  mappings: readonly HybridMappingEntry[],
): SemanticReport {
  const highConfidenceFields = mappings.filter((entry) => entry.tier === "deterministic");
  const mediumConfidenceFields = mappings.filter((entry) => entry.tier === "ai_candidate");
  const aiRequiredFields = mappings.filter((entry) => entry.tier === "ai_required");
  const unknownColumns = mappings.filter((entry) => entry.tier === "unknown");

  const columnsAnalyzed = mappings.length;
  const semanticCoverage =
    columnsAnalyzed > 0
      ? (highConfidenceFields.length + mediumConfidenceFields.length) / columnsAnalyzed
      : 0;
  const averageConfidence =
    columnsAnalyzed > 0
      ? mappings.reduce((sum, entry) => sum + (entry.topCandidate?.confidence ?? 0), 0) /
        columnsAnalyzed
      : 0;

  return {
    datasetType: datasetType.detectedType,
    datasetTypeConfidence: datasetType.confidence,
    columnsAnalyzed,
    highConfidenceFields,
    mediumConfidenceFields,
    aiRequiredFields,
    unknownColumns,
    semanticCoverage,
    averageConfidence,
  };
}
