import type { SemanticAnalysisResult } from "@/semantic/semantic-engine";
import type { DatasetType } from "@/semantic/dataset-intelligence/dataset-type-detector";
import type { ConfidenceTier, SemanticFieldId } from "@/semantic/types";

export interface SemanticFieldHint {
  readonly fieldId: SemanticFieldId;
  readonly confidence: number;
}

export interface SemanticColumnContext {
  readonly header: string;
  readonly tier: ConfidenceTier;
  readonly topCandidateField: SemanticFieldId | null;
  readonly topCandidateConfidence: number;
  readonly alternateCandidates: readonly SemanticFieldHint[];
}

/**
 * AI Context Enrichment's output: what the Prompt Compiler injects instead
 * of raw headers alone (Task 12.8 — "the AI does not rediscover everything").
 * Only "ai_candidate"/"ai_required" columns carry much information here on
 * purpose — "deterministic" columns don't need the AI's attention at all,
 * and the prompt should not waste tokens re-litigating them.
 */
export interface SemanticDatasetContext {
  readonly datasetType: DatasetType;
  readonly datasetTypeConfidence: number;
  readonly columns: readonly SemanticColumnContext[];
}

export function buildSemanticContext(result: SemanticAnalysisResult): SemanticDatasetContext {
  const columns = result.mappings.map((mapping): SemanticColumnContext => {
    const [top, ...rest] = mapping.candidates;
    return {
      header: mapping.header,
      tier: mapping.tier,
      topCandidateField: top?.fieldId ?? null,
      topCandidateConfidence: top?.confidence ?? 0,
      alternateCandidates: rest.map((candidate) => ({
        fieldId: candidate.fieldId,
        confidence: candidate.confidence,
      })),
    };
  });

  return {
    datasetType: result.datasetType.detectedType,
    datasetTypeConfidence: result.datasetType.confidence,
    columns,
  };
}
