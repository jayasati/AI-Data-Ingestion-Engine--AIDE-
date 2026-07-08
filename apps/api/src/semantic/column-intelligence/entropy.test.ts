import { describe, expect, it } from "vitest";
import { normalizedShannonEntropy } from "@/semantic/column-intelligence/entropy";

describe("normalizedShannonEntropy", () => {
  it("returns 0 for an empty column", () => {
    expect(normalizedShannonEntropy([])).toBe(0);
  });

  it("returns 0 when every value is identical", () => {
    expect(normalizedShannonEntropy(["New", "New", "New"])).toBe(0);
  });

  it("returns 1 when all values are unique and equally frequent", () => {
    expect(normalizedShannonEntropy(["a", "b", "c", "d"])).toBeCloseTo(1);
  });

  it("scores a low-cardinality distribution below a high-cardinality one", () => {
    const statusLike = normalizedShannonEntropy(["New", "New", "New", "Closed", "New", "New"]);
    const emailLike = normalizedShannonEntropy(["a@x.com", "b@x.com", "c@x.com", "d@x.com"]);
    expect(statusLike).toBeLessThan(emailLike);
  });
});
