import type {
  FieldCandidate,
  HeaderConfidenceProfile,
} from "@/semantic/confidence/confidence-engine";
import { DEFAULT_SEMANTIC_CONFIG, type SemanticConfig } from "@/semantic/config/semantic-config";
import type { ConfidenceTier } from "@/semantic/types";

export interface HybridMappingEntry {
  readonly columnIndex: number;
  readonly header: string;
  readonly tier: ConfidenceTier;
  readonly topCandidate: FieldCandidate | null;
  readonly candidates: readonly FieldCandidate[];
}

function tierFor(topConfidence: number | undefined, config: SemanticConfig): ConfidenceTier {
  if (topConfidence === undefined) {
    return "unknown";
  }
  if (topConfidence >= config.highConfidenceThreshold) {
    return "deterministic";
  }
  if (topConfidence >= config.mediumConfidenceThreshold) {
    return "ai_candidate";
  }
  return "ai_required";
}

/**
 * Not every field should go to AI: routes each header by its top candidate's
 * confidence into one of four tiers. "deterministic" headers can be mapped
 * without ever calling the LLM; "ai_candidate" headers still call it, but
 * armed with ranked hints instead of a blank slate; "ai_required" and
 * "unknown" get little or nothing to go on.
 */
export function mapFields(
  confidenceProfiles: readonly HeaderConfidenceProfile[],
  config: SemanticConfig = DEFAULT_SEMANTIC_CONFIG,
): readonly HybridMappingEntry[] {
  return confidenceProfiles.map((profile) => {
    const topCandidate = profile.candidates[0] ?? null;
    return {
      columnIndex: profile.columnIndex,
      header: profile.header,
      tier: tierFor(topCandidate?.confidence, config),
      topCandidate,
      candidates: profile.candidates,
    };
  });
}
