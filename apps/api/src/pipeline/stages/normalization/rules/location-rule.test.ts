import { describe, expect, it } from "vitest";
import { LocationRule } from "@/pipeline/stages/normalization/rules/location-rule";

describe("LocationRule", () => {
  const rule = new LocationRule();

  it("canApply always returns false -- never auto-triggered by the default pipeline", () => {
    expect(rule.canApply()).toBe(false);
  });

  it("Title Cases a lowercase place name when invoked directly", () => {
    const result = rule.apply("new york");
    expect(result.value).toBe("New York");
    expect(result.changed).toBe(true);
    expect(result.confidence).toBe(1);
  });

  it("Title Cases an all-uppercase place name", () => {
    const result = rule.apply("INDIA");
    expect(result.value).toBe("India");
  });

  it("trims surrounding whitespace", () => {
    const result = rule.apply("  bangalore  ");
    expect(result.value).toBe("Bangalore");
  });

  it("reports changed:false for an already Title Cased value", () => {
    const result = rule.apply("Germany");
    expect(result.changed).toBe(false);
  });
});
