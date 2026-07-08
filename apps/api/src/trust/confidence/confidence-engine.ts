import type { FieldValidationStatus } from "@/pipeline/domain/validation";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export interface FieldConfidenceInput {
  /** The extraction's own confidence for this field (LLM/semantic signal, `ExtractedField.confidence`). */
  readonly extractionConfidence: number;
  readonly validationStatus: FieldValidationStatus;
  readonly wasRepaired: boolean;
}

/**
 * Field Confidence — how much to trust ONE field's final value. A `missing`
 * (null) field is 0 by definition (nothing to be confident about, matching
 * `extraction-mapper.ts`'s own existing convention); an `invalid` value that
 * survived without a successful repair is strongly discounted; a repaired
 * value carries a smaller discount, since it needed intervention even though
 * it now validates.
 */
export function computeFieldConfidence(input: FieldConfidenceInput): number {
  if (input.validationStatus === "missing") {
    return 0;
  }
  let confidence = input.extractionConfidence;
  if (input.validationStatus === "invalid") {
    confidence *= 0.3;
  }
  if (input.wasRepaired) {
    confidence *= 0.8;
  }
  return clamp01(confidence);
}

export interface FieldConfidenceEntry {
  readonly confidence: number;
  readonly status: FieldValidationStatus;
}

export interface RecordConfidenceInput {
  readonly fields: readonly FieldConfidenceEntry[];
  readonly repairCount: number;
  readonly businessRuleErrorCount: number;
  readonly businessRuleWarningCount: number;
}

/**
 * Record Confidence — averages field confidence over fields that actually
 * carry a value (a sparse-but-correct record from a thin CSV should not be
 * punished for fields the source data never had; that's the Quality
 * Score's "missing fields" dimension, a deliberately separate concern),
 * then applies small, capped penalties for repairs and business-rule
 * violations on top.
 */
export function computeRecordConfidence(input: RecordConfidenceInput): number {
  const present = input.fields.filter((field) => field.status !== "missing");
  if (present.length === 0) {
    return 0;
  }

  const average = present.reduce((sum, field) => sum + field.confidence, 0) / present.length;
  const repairPenalty = Math.min(0.3, input.repairCount * 0.05);
  const errorPenalty = Math.min(0.5, input.businessRuleErrorCount * 0.2);
  const warningPenalty = Math.min(0.2, input.businessRuleWarningCount * 0.05);

  return clamp01(average - repairPenalty - errorPenalty - warningPenalty);
}

/** Dataset Confidence — the mean of every record's confidence. */
export function computeDatasetConfidence(recordConfidences: readonly number[]): number {
  if (recordConfidences.length === 0) {
    return 0;
  }
  return recordConfidences.reduce((sum, value) => sum + value, 0) / recordConfidences.length;
}
