import { describe, expect, it } from "vitest";
import { detectDelimiter } from "@/pipeline/stages/csv-parsing/delimiter-detector";

describe("detectDelimiter", () => {
  it("detects a comma delimiter", () => {
    expect(detectDelimiter("name,email,phone\nJohn,john@x.com,123")).toBe(",");
  });

  it("detects a semicolon delimiter", () => {
    expect(detectDelimiter("name;email;phone\nJohn;john@x.com;123")).toBe(";");
  });

  it("detects a pipe delimiter", () => {
    expect(detectDelimiter("name|email|phone\nJohn|john@x.com|123")).toBe("|");
  });

  it("detects a tab delimiter", () => {
    expect(detectDelimiter("name\temail\tphone\nJohn\tjohn@x.com\t123")).toBe("\t");
  });

  it("does not mistake a comma inside quotes for the real semicolon delimiter", () => {
    const content = 'name;note;phone\n"Doe, Jane";"hello, world";123\n"Roe, Jan";"hi, there";456';
    expect(detectDelimiter(content)).toBe(";");
  });

  it("falls back to comma when no candidate delimiter is present in every line", () => {
    expect(detectDelimiter("just a single column\nanother single column")).toBe(",");
  });

  it("falls back to comma for empty content", () => {
    expect(detectDelimiter("")).toBe(",");
  });

  it("requires a delimiter to appear in every sampled line, not just some", () => {
    // First line has a semicolon, second line does not - semicolon must not win.
    const content = "a;b\nc";
    expect(detectDelimiter(content)).toBe(",");
  });
});
