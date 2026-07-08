import { describe, expect, it } from "vitest";
import { SemanticKnowledgeBase } from "@/semantic/knowledge-base/knowledge-base";
import { normalizeHeaderName } from "@/pipeline/ingestion/header-engine";

describe("SemanticKnowledgeBase", () => {
  it("returns an exact_alias match with score 1 for a known alias", () => {
    const kb = new SemanticKnowledgeBase();
    const matches = kb.match(normalizeHeaderName("Email Address"));
    expect(matches).toEqual([
      { fieldId: "email", score: 1, matchType: "exact_alias", matchedAlias: "email_address" },
    ]);
  });

  it("falls back to fuzzy matching when there is no exact alias", () => {
    const kb = new SemanticKnowledgeBase();
    const matches = kb.match(normalizeHeaderName("Contact"));
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((m) => m.matchType === "fuzzy")).toBe(true);
    expect(matches).toEqual([...matches].sort((a, b) => b.score - a.score));
  });

  it("returns no matches for a header unrelated to any cluster", () => {
    const kb = new SemanticKnowledgeBase();
    expect(kb.match(normalizeHeaderName("Xyzzy Plugh Quux"))).toEqual([]);
  });

  it("caps fuzzy matches at maxFuzzyMatchesPerHeader", () => {
    const kb = new SemanticKnowledgeBase(undefined, {
      fuzzyMatchThreshold: 0,
      maxFuzzyMatchesPerHeader: 2,
      ambiguityMargin: 0.1,
      ruleWeights: { header: 1, knowledge: 1, regex: 1, pattern: 1, historical: 1 },
      statisticalInfluence: 0.2,
      minReportedConfidence: 0.05,
      maxCandidatesPerHeader: 5,
      highConfidenceThreshold: 0.85,
      mediumConfidenceThreshold: 0.4,
      classifierLikelyThreshold: 0.5,
    });
    const matches = kb.match(normalizeHeaderName("Something"));
    expect(matches.length).toBeLessThanOrEqual(2);
  });

  it("lets a custom alias be registered and immediately matched", () => {
    const kb = new SemanticKnowledgeBase();
    kb.registerCustomAlias("Reach Out At", "phone");
    expect(kb.match(normalizeHeaderName("Reach Out At"))).toEqual([
      { fieldId: "phone", score: 1, matchType: "exact_alias", matchedAlias: "reach_out_at" },
    ]);
  });

  it("clusterFor returns the cluster definition for a field id", () => {
    const kb = new SemanticKnowledgeBase();
    expect(kb.clusterFor("email")?.label).toBe("Email");
    expect(kb.clusterFor("possession_time")?.aliases).toContain("possession");
  });
});
