import { describe, expect, it } from "vitest";
import { disambiguateHeaders } from "@/pipeline/stages/csv-parsing/header-disambiguator";

describe("disambiguateHeaders", () => {
  it("renames exact-duplicate headers with a (2), (3)... suffix", () => {
    const result = disambiguateHeaders(["Email", "Email", "Email"]);
    expect(result.headers).toEqual(["Email", "Email (2)", "Email (3)"]);
    expect(result.duplicatesRenamed).toBe(2);
  });

  it("flags wasOriginallyDuplicate for every occurrence, including the first", () => {
    const result = disambiguateHeaders(["Email", "Name", "Email"]);
    expect(result.wasOriginallyDuplicate).toEqual([true, false, true]);
  });

  it("gives blank headers a positional placeholder", () => {
    const result = disambiguateHeaders(["Name", "", "  ", "Email"]);
    expect(result.headers).toEqual(["Name", "Column 2", "Column 3", "Email"]);
    expect(result.emptyHeadersRenamed).toBe(2);
  });

  it("never marks a blank header as originally duplicate", () => {
    const result = disambiguateHeaders(["", ""]);
    expect(result.wasOriginallyDuplicate).toEqual([false, false]);
  });

  it("handles a duplicate pair, a blank header, and distinct headers together", () => {
    const result = disambiguateHeaders(["Name", "Email", "", "Email", "Phone"]);
    expect(result.headers).toEqual(["Name", "Email", "Column 3", "Email (2)", "Phone"]);
    expect(result.duplicatesRenamed).toBe(1);
    expect(result.emptyHeadersRenamed).toBe(1);
    expect(result.wasOriginallyDuplicate).toEqual([false, true, false, true, false]);
  });

  it("does not treat distinct headers as duplicates", () => {
    const result = disambiguateHeaders(["Name", "Email", "Phone"]);
    expect(result.headers).toEqual(["Name", "Email", "Phone"]);
    expect(result.duplicatesRenamed).toBe(0);
    expect(result.wasOriginallyDuplicate).toEqual([false, false, false]);
  });

  it("returns an empty result for an empty header list", () => {
    const result = disambiguateHeaders([]);
    expect(result.headers).toEqual([]);
    expect(result.duplicatesRenamed).toBe(0);
    expect(result.emptyHeadersRenamed).toBe(0);
    expect(result.wasOriginallyDuplicate).toEqual([]);
  });
});
