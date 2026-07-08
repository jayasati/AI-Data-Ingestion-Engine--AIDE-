import { describe, expect, it } from "vitest";
import type { DateFieldDetails } from "@/pipeline/domain/normalization";
import { DateRule } from "@/pipeline/stages/normalization/rules/date-rule";

describe("DateRule", () => {
  const rule = new DateRule();

  it("canApply is true for date-shaped values", () => {
    expect(rule.canApply("2026-01-15")).toBe(true);
  });

  it("canApply is false for a plain word", () => {
    expect(rule.canApply("hello")).toBe(false);
  });

  it.each(["2026-01-15", "2026/01/15", "12-May-2026", "15/01/2026", "15.01.2026"])(
    "canApply is true for every format apply() can actually parse: %s",
    (value) => {
      expect(rule.canApply(value)).toBe(true);
      const details = rule.apply(value).details as DateFieldDetails;
      expect(details.iso).not.toBeNull();
    },
  );

  it("parses ISO 8601 (YYYY-MM-DD)", () => {
    const result = rule.apply("2026-01-15");
    expect(result.value).toBe("2026-01-15");
    expect(result.confidence).toBe(1);
    const details = result.details as DateFieldDetails;
    expect(details.iso).toBe("2026-01-15");
    expect(details.matchedFormat).toBe("YYYY-MM-DD");
  });

  it("parses ISO 8601 with a time suffix", () => {
    const result = rule.apply("2026-01-15T10:30:00Z");
    const details = result.details as DateFieldDetails;
    expect(details.iso).toBe("2026-01-15");
  });

  it("parses YYYY/MM/DD", () => {
    const result = rule.apply("2026/01/15");
    const details = result.details as DateFieldDetails;
    expect(details.iso).toBe("2026-01-15");
    expect(details.matchedFormat).toBe("YYYY/MM/DD");
  });

  it("parses DD-MMM-YYYY", () => {
    const result = rule.apply("12-May-2026");
    const details = result.details as DateFieldDetails;
    expect(details.iso).toBe("2026-05-12");
    expect(details.matchedFormat).toBe("DD-MMM-YYYY");
  });

  it("resolves an unambiguous DD/MM/YYYY (day > 12)", () => {
    const result = rule.apply("25/12/2026");
    const details = result.details as DateFieldDetails;
    expect(details.iso).toBe("2026-12-25");
    expect(details.matchedFormat).toBe("DD/MM/YYYY");
    expect(result.confidence).toBe(1);
  });

  it("resolves an unambiguous MM/DD/YYYY (second part > 12)", () => {
    const result = rule.apply("12/25/2026");
    const details = result.details as DateFieldDetails;
    expect(details.iso).toBe("2026-12-25");
    expect(details.matchedFormat).toBe("MM/DD/YYYY");
    expect(result.confidence).toBe(1);
  });

  it("refuses to guess when both day and month are <= 12 (genuinely ambiguous)", () => {
    const result = rule.apply("05/06/2026");
    const details = result.details as DateFieldDetails;
    expect(details.iso).toBeNull();
    expect(result.value).toBe("05/06/2026"); // original preserved, not guessed
    expect(result.changed).toBe(false);
    expect(result.confidence).toBe(0.3);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings?.[0].code).toBe("AMBIGUOUS_DATE");
  });

  it("flags an unparseable date-shaped value (invalid calendar date)", () => {
    const result = rule.apply("35/13/2026");
    const details = result.details as DateFieldDetails;
    expect(details.iso).toBeNull();
    expect(result.confidence).toBe(0.2);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings?.[0].code).toBe("UNPARSEABLE_DATE");
  });

  it("expands a 2-digit year by adding 2000", () => {
    const result = rule.apply("25/12/26");
    const details = result.details as DateFieldDetails;
    expect(details.iso).toBe("2026-12-25");
  });

  it("supports . and - as separators for numeric dates, matching the / ambiguity rules", () => {
    expect((rule.apply("25.12.2026").details as DateFieldDetails).iso).toBe("2026-12-25");
    expect((rule.apply("25-12-2026").details as DateFieldDetails).iso).toBe("2026-12-25");
  });
});
