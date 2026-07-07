import { describe, expect, it } from "vitest";
import { inspectFile } from "@/pipeline/stages/csv-parsing/file-inspector";

// Built from a numeric code point, never a literal glyph - literal invisible
// Unicode characters have been silently corrupted in transit in this project before.
const BOM = String.fromCharCode(0xfeff);

describe("inspectFile", () => {
  it("strips a leading byte-order mark and labels the encoding", () => {
    const result = inspectFile(`${BOM}Name,Email\nJohn,john@x.com`);
    expect(result.hadByteOrderMark).toBe(true);
    expect(result.encodingLabel).toBe("UTF-8 (BOM)");
    expect(result.content).toBe("Name,Email\nJohn,john@x.com");
    expect(result.content.startsWith(BOM)).toBe(false);
  });

  it("passes content through unchanged when there is no BOM", () => {
    const result = inspectFile("Name,Email\nJohn,john@x.com");
    expect(result.hadByteOrderMark).toBe(false);
    expect(result.encodingLabel).toBe("UTF-8");
    expect(result.content).toBe("Name,Email\nJohn,john@x.com");
  });

  it("lets a declared encoding override the BOM-based label", () => {
    const result = inspectFile(`${BOM}Name,Email`, "UTF-16LE");
    expect(result.hadByteOrderMark).toBe(true);
    expect(result.encodingLabel).toBe("UTF-16LE");
    expect(result.content).toBe("Name,Email");
  });

  it("lets a declared encoding apply even without a BOM present", () => {
    const result = inspectFile("Name,Email", "UTF-16LE");
    expect(result.hadByteOrderMark).toBe(false);
    expect(result.encodingLabel).toBe("UTF-16LE");
  });

  it("only strips a BOM at the very start, not one appearing mid-content", () => {
    const result = inspectFile(`Name,Email\nJoh${BOM}n,john@x.com`);
    expect(result.hadByteOrderMark).toBe(false);
    expect(result.content).toContain(BOM);
  });
});
