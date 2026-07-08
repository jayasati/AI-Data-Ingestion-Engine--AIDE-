import { describe, expect, it } from "vitest";
import { computeQualityScore } from "@/trust/quality/quality-score";

const PERFECT = {
  missingFieldCount: 0,
  repairCount: 0,
  recordConfidence: 1,
  semanticMatchAverage: 1,
  businessRuleViolationCount: 0,
  validationErrorCount: 0,
};

describe("computeQualityScore", () => {
  it("scores a perfect record at exactly 100", () => {
    expect(computeQualityScore(PERFECT)).toBe(100);
  });

  it("scores a fully unconfident but otherwise clean record well below 100", () => {
    const score = computeQualityScore({ ...PERFECT, recordConfidence: 0, semanticMatchAverage: 0 });
    expect(score).toBe(0);
  });

  it("deducts for missing fields", () => {
    const score = computeQualityScore({ ...PERFECT, missingFieldCount: 5 });
    expect(score).toBeLessThan(100);
  });

  it("caps the missing-fields penalty so a thin-but-correct record still clears the approval bar", () => {
    // A realistic minimum CSV (name/email/phone/status) populates ~4 of 15
    // fields — 11 legitimately null, not defective. That must not tank the
    // score below a typical approvedQualityThreshold (70).
    const score = computeQualityScore({ ...PERFECT, missingFieldCount: 11 });
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it("does not keep penalizing beyond the missing-fields cap", () => {
    const at6 = computeQualityScore({ ...PERFECT, missingFieldCount: 6 });
    const at20 = computeQualityScore({ ...PERFECT, missingFieldCount: 20 });
    expect(at20).toBe(at6);
  });

  it("deducts for repairs", () => {
    const score = computeQualityScore({ ...PERFECT, repairCount: 3 });
    expect(score).toBeLessThan(100);
  });

  it("deducts more for business rule violations than for repairs, given the default weights", () => {
    const repairScore = computeQualityScore({ ...PERFECT, repairCount: 1 });
    const violationScore = computeQualityScore({ ...PERFECT, businessRuleViolationCount: 1 });
    expect(violationScore).toBeLessThan(repairScore);
  });

  it("deducts for validation errors", () => {
    const score = computeQualityScore({ ...PERFECT, validationErrorCount: 2 });
    expect(score).toBeLessThan(100);
  });

  it("never goes below 0 even with extreme penalties", () => {
    const score = computeQualityScore({
      missingFieldCount: 1000,
      repairCount: 1000,
      recordConfidence: 0,
      semanticMatchAverage: 0,
      businessRuleViolationCount: 1000,
      validationErrorCount: 1000,
    });
    expect(score).toBe(0);
  });

  it("never exceeds 100", () => {
    expect(computeQualityScore(PERFECT)).toBeLessThanOrEqual(100);
  });

  it("returns an integer", () => {
    const score = computeQualityScore({ ...PERFECT, recordConfidence: 0.837 });
    expect(Number.isInteger(score)).toBe(true);
  });
});
