import { describe, expect, it } from "vitest";
import { diceCoefficient } from "@/semantic/knowledge-base/text-similarity";

describe("diceCoefficient", () => {
  it("returns 1 for identical strings", () => {
    expect(diceCoefficient("email", "email")).toBe(1);
  });

  it("returns 0 for completely dissimilar strings", () => {
    expect(diceCoefficient("email", "possession")).toBeLessThan(0.2);
  });

  it("returns 0 when either string is shorter than a bigram", () => {
    expect(diceCoefficient("a", "email")).toBe(0);
    expect(diceCoefficient("email", "")).toBe(0);
  });

  it("scores partial overlaps between 0 and 1", () => {
    const score = diceCoefficient("contact_number", "phone_number");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("is symmetric", () => {
    expect(diceCoefficient("contact_number", "phone_number")).toBe(
      diceCoefficient("phone_number", "contact_number"),
    );
  });
});
