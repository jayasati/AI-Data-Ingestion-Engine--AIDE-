import { describe, expect, it } from "vitest";
import {
  computeDatasetConfidence,
  computeFieldConfidence,
  computeRecordConfidence,
} from "@/trust/confidence/confidence-engine";

describe("computeFieldConfidence", () => {
  it("is 0 for a missing field regardless of extraction confidence", () => {
    expect(
      computeFieldConfidence({
        extractionConfidence: 1,
        validationStatus: "missing",
        wasRepaired: false,
      }),
    ).toBe(0);
  });

  it("keeps full confidence for a valid, un-repaired field", () => {
    expect(
      computeFieldConfidence({
        extractionConfidence: 1,
        validationStatus: "valid",
        wasRepaired: false,
      }),
    ).toBe(1);
  });

  it("strongly discounts an invalid field", () => {
    const confidence = computeFieldConfidence({
      extractionConfidence: 1,
      validationStatus: "invalid",
      wasRepaired: false,
    });
    expect(confidence).toBeLessThan(0.5);
  });

  it("mildly discounts a repaired field", () => {
    const confidence = computeFieldConfidence({
      extractionConfidence: 1,
      validationStatus: "valid",
      wasRepaired: true,
    });
    expect(confidence).toBeCloseTo(0.8);
  });
});

describe("computeRecordConfidence", () => {
  it("averages only over present (non-missing) fields", () => {
    const confidence = computeRecordConfidence({
      fields: [
        { confidence: 1, status: "valid" },
        { confidence: 1, status: "valid" },
        { confidence: 0, status: "missing" },
        { confidence: 0, status: "missing" },
      ],
      repairCount: 0,
      businessRuleErrorCount: 0,
      businessRuleWarningCount: 0,
    });
    expect(confidence).toBe(1);
  });

  it("returns 0 when every field is missing", () => {
    const confidence = computeRecordConfidence({
      fields: [{ confidence: 0, status: "missing" }],
      repairCount: 0,
      businessRuleErrorCount: 0,
      businessRuleWarningCount: 0,
    });
    expect(confidence).toBe(0);
  });

  it("applies a capped penalty for repairs", () => {
    const confidence = computeRecordConfidence({
      fields: [{ confidence: 1, status: "valid" }],
      repairCount: 100,
      businessRuleErrorCount: 0,
      businessRuleWarningCount: 0,
    });
    expect(confidence).toBeCloseTo(0.7); // 1 - min(0.3, 100*0.05)
  });

  it("applies a capped penalty for business rule errors and warnings", () => {
    const confidence = computeRecordConfidence({
      fields: [{ confidence: 1, status: "valid" }],
      repairCount: 0,
      businessRuleErrorCount: 100,
      businessRuleWarningCount: 100,
    });
    expect(confidence).toBeCloseTo(0.3); // 1 - min(0.5, ...) - min(0.2, ...)
  });

  it("never goes below 0", () => {
    const confidence = computeRecordConfidence({
      fields: [{ confidence: 0, status: "invalid" }],
      repairCount: 100,
      businessRuleErrorCount: 100,
      businessRuleWarningCount: 100,
    });
    expect(confidence).toBe(0);
  });
});

describe("computeDatasetConfidence", () => {
  it("averages record confidences", () => {
    expect(computeDatasetConfidence([1, 0.5, 0])).toBeCloseTo(0.5);
  });

  it("returns 0 for an empty dataset", () => {
    expect(computeDatasetConfidence([])).toBe(0);
  });
});
