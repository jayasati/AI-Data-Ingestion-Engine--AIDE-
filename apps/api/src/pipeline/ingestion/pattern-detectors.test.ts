import { describe, expect, it } from "vitest";
import {
  looksLikeDate,
  looksLikeEmail,
  looksLikeNumeric,
  looksLikePhone,
} from "@/pipeline/ingestion/pattern-detectors";

describe("looksLikeEmail", () => {
  it.each([
    ["john@example.com", true],
    ["JANE@EXAMPLE.COM", true],
    ["first.last+tag@sub.example.co.uk", true],
    ["not-an-email", false],
    ["missing-at.example.com", false],
    ["@example.com", false],
    ["john@", false],
    ["", false],
  ])("%s -> %s", (value, expected) => {
    expect(looksLikeEmail(value)).toBe(expected);
  });
});

describe("looksLikeDate", () => {
  it.each([
    ["2026-01-15", true],
    ["2026-01-15T00:00:00Z", true],
    ["01/20/2026", true],
    ["1/2/26", true],
    ["2026-02-01", true],
    ["12.05.2026", true],
    ["not a date", false],
    ["", false],
  ])("%s -> %s", (value, expected) => {
    expect(looksLikeDate(value)).toBe(expected);
  });
});

describe("looksLikePhone", () => {
  it.each([
    ["9876543210", true],
    ["555-123-4567", true],
    ["+1 (555) 123-4567", true],
    ["111", false], // too few digits (3 < 7)
    ["12345678901234567890", false], // too many digits (>15)
    ["not a phone", false],
  ])("%s -> %s", (value, expected) => {
    expect(looksLikePhone(value)).toBe(expected);
  });

  it("does not flag a dashed date as a phone number, even though the digit count would otherwise qualify", () => {
    expect(looksLikePhone("2026-01-15")).toBe(false);
    expect(looksLikeDate("2026-01-15")).toBe(true);
  });

  it("rejects a value containing characters outside the allowed phone charset", () => {
    expect(looksLikePhone("01/20/2026")).toBe(false); // slash is not allowed
  });
});

describe("looksLikeNumeric", () => {
  it.each([
    ["45000", true],
    ["45,000", true],
    ["$45,000", true],
    ["$1,234.56", true],
    ["45%", true],
    ["-12.5", true],
    ["+3", true],
    ["1,200.50", true],
    ["not a number", false],
    ["", false],
    ["12-34", false],
  ])("%s -> %s", (value, expected) => {
    expect(looksLikeNumeric(value)).toBe(expected);
  });
});
