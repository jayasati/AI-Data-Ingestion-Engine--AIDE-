import type { RuleContext, RuleSignal, SemanticRule } from "@/semantic/rules/rule-types";

/**
 * Historical Rules placeholder — a real implementation would consult
 * learned/remembered header->field mappings from past imports (the docs'
 * "Semantic Memory" idea). Explicitly out of scope this volume ("NO Semantic
 * Memory"): this rule always returns no signals, kept only so the Confidence
 * Engine's six named sources are all wired up and swapping in a real
 * implementation later needs no change anywhere else.
 */
export const historicalRule: SemanticRule = {
  id: "historical-rules",
  category: "historical",
  evaluate(_context: RuleContext): readonly RuleSignal[] {
    return [];
  },
};
