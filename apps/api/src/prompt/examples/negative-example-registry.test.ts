import { describe, expect, it } from "vitest";
import {
  NEGATIVE_EXAMPLES,
  selectNegativeExamples,
} from "@/prompt/examples/negative-example-registry";

describe("NEGATIVE_EXAMPLES", () => {
  it("includes the three canonical wrong mappings from the spec", () => {
    const pairs = NEGATIVE_EXAMPLES.map((e) => `${e.sourceField}->${e.incorrectTargetField}`);
    expect(pairs).toContain("Company->lead_owner");
    expect(pairs).toContain("Phone->company");
    expect(pairs).toContain("City->country");
  });

  it("every entry has a non-empty explanation", () => {
    for (const example of NEGATIVE_EXAMPLES) {
      expect(example.explanation.length).toBeGreaterThan(0);
    }
  });
});

describe("selectNegativeExamples", () => {
  it("returns at most `limit` examples, in curated order", () => {
    const selected = selectNegativeExamples(2);
    expect(selected).toEqual(NEGATIVE_EXAMPLES.slice(0, 2));
  });

  it("returns an empty array for a non-positive limit", () => {
    expect(selectNegativeExamples(0)).toEqual([]);
    expect(selectNegativeExamples(-1)).toEqual([]);
  });

  it("caps at the available example count when limit exceeds it", () => {
    expect(selectNegativeExamples(1000)).toEqual(NEGATIVE_EXAMPLES);
  });
});
