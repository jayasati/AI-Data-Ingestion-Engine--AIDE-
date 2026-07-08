import type { RuleContext, RuleSignal, SemanticRule } from "@/semantic/rules/rule-types";

/** Header Similarity source: fuzzy (non-exact) knowledge-base matches on the header's own text. */
export const headerRule: SemanticRule = {
  id: "header-similarity",
  category: "header",
  evaluate(context: RuleContext): readonly RuleSignal[] {
    return context.header.candidates
      .filter((candidate) => candidate.matchType === "fuzzy")
      .map((candidate) => ({
        fieldId: candidate.fieldId,
        weight: candidate.score,
        source: "header-similarity",
        detail: `Header "${context.header.originalHeader}" resembles known ${candidate.fieldId} aliases (${Math.round(candidate.score * 100)}% similar).`,
      }));
  },
};
