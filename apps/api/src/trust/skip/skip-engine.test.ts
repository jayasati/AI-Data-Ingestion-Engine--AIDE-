import { describe, expect, it } from "vitest";
import { evaluateSkip } from "@/trust/skip/skip-engine";
import { DEFAULT_TRUST_CONFIG } from "@/trust/config/trust-config";
import type { ExtractedField, ExtractedRecord } from "@/pipeline/domain/extraction";

function record(email: string | null, phone: string | null): ExtractedRecord {
  const fields: ExtractedField[] = [
    { sourceHeader: "Email", targetField: "email", value: email, confidence: email ? 1 : 0 },
    {
      sourceHeader: "Phone",
      targetField: "mobile_without_country_code",
      value: phone,
      confidence: phone ? 1 : 0,
    },
  ];
  return { rowNumber: 1, fields };
}

describe("evaluateSkip", () => {
  it("skips a record with neither email nor phone", () => {
    const decision = evaluateSkip(record(null, null));
    expect(decision.skipped).toBe(true);
    expect(decision.reason).toBeTruthy();
  });

  it("does not skip when only email is present", () => {
    expect(evaluateSkip(record("john@example.com", null)).skipped).toBe(false);
  });

  it("does not skip when only phone is present", () => {
    expect(evaluateSkip(record(null, "9833311111")).skipped).toBe(false);
  });

  it("does not skip when both are present", () => {
    expect(evaluateSkip(record("john@example.com", "9833311111")).skipped).toBe(false);
  });

  it("treats an empty-after-trim value the same as null", () => {
    expect(evaluateSkip(record("   ", "   ")).skipped).toBe(true);
  });

  it("never skips when requireEmailOrPhone is disabled", () => {
    const decision = evaluateSkip(record(null, null), {
      ...DEFAULT_TRUST_CONFIG,
      requireEmailOrPhone: false,
    });
    expect(decision.skipped).toBe(false);
  });
});
