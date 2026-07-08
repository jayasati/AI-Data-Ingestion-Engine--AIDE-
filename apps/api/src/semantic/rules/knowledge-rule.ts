import type { RuleContext, RuleSignal, SemanticRule } from "@/semantic/rules/rule-types";

/** Knowledge Base source: an exact alias match, the strongest header-side signal there is. */
export const knowledgeRule: SemanticRule = {
  id: "knowledge-base",
  category: "knowledge",
  evaluate(context: RuleContext): readonly RuleSignal[] {
    return context.header.candidates
      .filter((candidate) => candidate.matchType === "exact_alias")
      .map((candidate) => ({
        fieldId: candidate.fieldId,
        weight: candidate.score,
        source: "knowledge-base",
        detail: `Header "${context.header.originalHeader}" is a known alias for ${candidate.fieldId}.`,
      }));
  },
};
