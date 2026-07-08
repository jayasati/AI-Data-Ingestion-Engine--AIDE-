import { describe, expect, it } from "vitest";
import {
  DEFAULT_NULL_ALIASES,
  isEmptyToken,
} from "@/pipeline/stages/normalization/empty-token-detector";

describe("isEmptyToken", () => {
  it.each([
    "",
    "n/a",
    "N/A",
    "na",
    "NA",
    "#n/a",
    "-",
    "--",
    "null",
    "NULL",
    "none",
    "unknown",
    "nil",
    "undefined",
  ])("recognizes %j as a default null alias", (value) => {
    expect(isEmptyToken(value)).toBe(true);
  });

  it("is case-insensitive and trims surrounding whitespace", () => {
    expect(isEmptyToken("  N/a  ")).toBe(true);
  });

  it("returns false for real data", () => {
    expect(isEmptyToken("John Doe")).toBe(false);
    expect(isEmptyToken("0")).toBe(false);
  });

  it("DEFAULT_NULL_ALIASES contains exactly the documented set", () => {
    expect([...DEFAULT_NULL_ALIASES].sort()).toEqual(
      ["", "#n/a", "-", "--", "n/a", "na", "nil", "none", "null", "undefined", "unknown"].sort(),
    );
  });

  it("accepts a custom alias set that fully replaces the default", () => {
    const customAliases = new Set(["missing", "tbd"]);
    expect(isEmptyToken("missing", customAliases)).toBe(true);
    expect(isEmptyToken("n/a", customAliases)).toBe(false);
  });
});
