import type { SemanticFieldId } from "@/semantic/types";

export interface ClassifierResult {
  /** Fraction (0-1) of non-empty values that matched. 0 if there were no values to check. */
  readonly matchRatio: number;
  /** Up to a few matched sample values, for the Semantic Report and prompt evidence. */
  readonly evidence: readonly string[];
}

/**
 * Common interface every deterministic field classifier implements — value-only,
 * deliberately blind to the header. That split is what lets the same header
 * ("Contact") classify differently depending purely on what the column's
 * values look like, which header text alone can never resolve.
 *
 * `fieldId: null` marks a "descriptive" classifier (currency, location) whose
 * result never becomes a candidate mapping by itself — the report surfaces it
 * as a flag (e.g. `likelyCurrency`), and the Confidence Engine's PatternRule
 * uses it only to reinforce a field already hypothesized by header/knowledge
 * matching (see rules/pattern-rule.ts).
 */
export interface FieldClassifier {
  readonly id: string;
  readonly fieldId: SemanticFieldId | null;
  readonly category: "regex" | "pattern";
  classify(values: readonly string[]): ClassifierResult;
}

const EVIDENCE_LIMIT = 3;

export function buildClassifierResult(
  values: readonly string[],
  isMatch: (value: string) => boolean,
): ClassifierResult {
  if (values.length === 0) {
    return { matchRatio: 0, evidence: [] };
  }

  const matched = values.filter(isMatch);
  return {
    matchRatio: matched.length / values.length,
    evidence: [...new Set(matched)].slice(0, EVIDENCE_LIMIT),
  };
}
