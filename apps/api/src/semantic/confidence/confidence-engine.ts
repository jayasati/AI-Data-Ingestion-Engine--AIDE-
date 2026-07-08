import { DEFAULT_RULES } from "@/semantic/rules";
import type { RuleContext, SemanticRule } from "@/semantic/rules/rule-types";
import { DEFAULT_SEMANTIC_CONFIG, type SemanticConfig } from "@/semantic/config/semantic-config";
import type { SemanticFieldId } from "@/semantic/types";

export interface ConfidenceEvidence {
  readonly source: string;
  readonly weight: number;
  readonly detail: string;
}

export interface FieldCandidate {
  readonly fieldId: SemanticFieldId;
  readonly confidence: number;
  readonly evidence: readonly ConfidenceEvidence[];
}

export interface HeaderConfidenceProfile {
  readonly columnIndex: number;
  readonly header: string;
  readonly candidates: readonly FieldCandidate[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Combines every rule's signals for one header into ranked field candidates.
 *
 * Non-statistical rules (header, knowledge, regex, pattern) combine via
 * noisy-OR — `confidence = 1 - Π(1 - weight_i)` — so independent corroborating
 * signals compound (two 0.5s become 0.75) without a single weak signal ever
 * being inflated by normalization. StatisticalRule then applies a signed,
 * scaled adjustment on top, but only to fields that already have a base
 * hypothesis — it can confirm or refute, never invent a candidate outright.
 */
export function computeHeaderConfidence(
  context: RuleContext,
  rules: readonly SemanticRule[] = DEFAULT_RULES,
  config: SemanticConfig = DEFAULT_SEMANTIC_CONFIG,
): HeaderConfidenceProfile {
  const complementByField = new Map<SemanticFieldId, number>();
  const evidenceByField = new Map<SemanticFieldId, ConfidenceEvidence[]>();

  const pushEvidence = (fieldId: SemanticFieldId, evidence: ConfidenceEvidence): void => {
    const list = evidenceByField.get(fieldId) ?? [];
    list.push(evidence);
    evidenceByField.set(fieldId, list);
  };

  for (const rule of rules) {
    if (rule.category === "statistical") {
      continue;
    }
    const coefficient = config.ruleWeights[rule.category];
    for (const signal of rule.evaluate(context)) {
      const weight = clamp01(signal.weight * coefficient);
      const previousComplement = complementByField.get(signal.fieldId) ?? 1;
      complementByField.set(signal.fieldId, previousComplement * (1 - weight));
      pushEvidence(signal.fieldId, { source: signal.source, weight, detail: signal.detail });
    }
  }

  const confidenceByField = new Map<SemanticFieldId, number>();
  for (const [fieldId, complement] of complementByField) {
    confidenceByField.set(fieldId, 1 - complement);
  }

  for (const rule of rules) {
    if (rule.category !== "statistical") {
      continue;
    }
    for (const signal of rule.evaluate(context)) {
      const base = confidenceByField.get(signal.fieldId);
      if (base === undefined) {
        continue;
      }
      const adjusted = clamp01(base + signal.weight * config.statisticalInfluence);
      confidenceByField.set(signal.fieldId, adjusted);
      pushEvidence(signal.fieldId, {
        source: signal.source,
        weight: signal.weight * config.statisticalInfluence,
        detail: signal.detail,
      });
    }
  }

  const candidates = [...confidenceByField.entries()]
    .map(([fieldId, confidence]) => ({
      fieldId,
      confidence,
      evidence: evidenceByField.get(fieldId) ?? [],
    }))
    .filter((candidate) => candidate.confidence >= config.minReportedConfidence)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, config.maxCandidatesPerHeader);

  return {
    columnIndex: context.header.columnIndex,
    header: context.header.originalHeader,
    candidates,
  };
}
