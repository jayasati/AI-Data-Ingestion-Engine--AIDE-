import { describe, expect, it } from "vitest";
import { analyzeHeaders } from "@/semantic/header-intelligence/header-analyzer";

describe("analyzeHeaders", () => {
  it("produces one profile per header, in order, with normalized headers", () => {
    const profiles = analyzeHeaders(["Customer Name", "Email Address"]);
    expect(profiles).toHaveLength(2);
    expect(profiles[0]).toMatchObject({
      columnIndex: 0,
      originalHeader: "Customer Name",
      normalizedHeader: "customer_name",
    });
    expect(profiles[1].normalizedHeader).toBe("email_address");
  });

  it("gives an exact-alias header a single dominant candidate", () => {
    const [profile] = analyzeHeaders(["Email"]);
    expect(profile.candidates[0]).toMatchObject({
      fieldId: "email",
      score: 1,
      matchType: "exact_alias",
    });
  });

  it("treats synonyms (Buyer, Prospect, Lead) as candidates for the same cluster", () => {
    const profiles = analyzeHeaders(["Customer Name", "Buyer", "Prospect", "Lead"]);
    for (const profile of profiles) {
      expect(profile.candidates.some((c) => c.fieldId === "name")).toBe(true);
    }
  });

  it("flags an ambiguous header whose top two candidates are close in score", () => {
    const [profile] = analyzeHeaders(["Contact"]);
    expect(profile.candidates.length).toBeGreaterThanOrEqual(1);
    if (profile.candidates.length >= 2) {
      const gap = profile.candidates[0].score - profile.candidates[1].score;
      expect(profile.isAmbiguous).toBe(gap < 0.1);
    } else {
      expect(profile.isAmbiguous).toBe(false);
    }
  });

  it("returns no candidates and is not ambiguous for a header unrelated to any cluster", () => {
    const [profile] = analyzeHeaders(["Zzyzx Qwerty"]);
    expect(profile.candidates).toEqual([]);
    expect(profile.isAmbiguous).toBe(false);
  });
});
