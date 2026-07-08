import { describe, expect, it } from "vitest";
import { mapFields } from "@/semantic/mapping/hybrid-mapper";
import type { HeaderConfidenceProfile } from "@/semantic/confidence/confidence-engine";

function profile(
  columnIndex: number,
  header: string,
  confidences: number[],
): HeaderConfidenceProfile {
  return {
    columnIndex,
    header,
    candidates: confidences.map((confidence, i) => ({
      fieldId: (["email", "phone", "lead_owner"] as const)[i],
      confidence,
      evidence: [],
    })),
  };
}

describe("mapFields", () => {
  it("routes a >=0.85 top candidate to the deterministic tier", () => {
    const [entry] = mapFields([profile(0, "Email", [0.95])]);
    expect(entry.tier).toBe("deterministic");
    expect(entry.topCandidate?.fieldId).toBe("email");
  });

  it("routes a 0.4-0.85 top candidate to ai_candidate", () => {
    const [entry] = mapFields([profile(0, "Contact", [0.6, 0.2])]);
    expect(entry.tier).toBe("ai_candidate");
    expect(entry.candidates).toHaveLength(2);
  });

  it("routes a below-0.4 top candidate to ai_required", () => {
    const [entry] = mapFields([profile(0, "Info", [0.2])]);
    expect(entry.tier).toBe("ai_required");
  });

  it("routes a header with no candidates at all to unknown", () => {
    const [entry] = mapFields([profile(0, "Mystery", [])]);
    expect(entry.tier).toBe("unknown");
    expect(entry.topCandidate).toBeNull();
  });

  it("respects custom thresholds", () => {
    const [entry] = mapFields([profile(0, "Email", [0.5])], {
      fuzzyMatchThreshold: 0.45,
      maxFuzzyMatchesPerHeader: 3,
      ambiguityMargin: 0.1,
      ruleWeights: { header: 1, knowledge: 1, regex: 1, pattern: 1, historical: 1 },
      statisticalInfluence: 0.2,
      minReportedConfidence: 0.05,
      maxCandidatesPerHeader: 5,
      highConfidenceThreshold: 0.4,
      mediumConfidenceThreshold: 0.2,
      classifierLikelyThreshold: 0.5,
    });
    expect(entry.tier).toBe("deterministic");
  });
});
