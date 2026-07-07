import { describe, expect, it } from "vitest";
import { iterateCsvRecords, tokenizeCsv } from "@/pipeline/stages/csv-parsing/csv-tokenizer";

describe("tokenizeCsv", () => {
  it("splits on a comma delimiter", () => {
    expect(tokenizeCsv("a,b,c\n1,2,3", ",")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("splits on a semicolon delimiter", () => {
    expect(tokenizeCsv("a;b;c\n1;2;3", ";")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("splits on a tab delimiter", () => {
    expect(tokenizeCsv("a\tb\tc\n1\t2\t3", "\t")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("keeps a delimiter embedded in a quoted field intact", () => {
    expect(tokenizeCsv('a,"b,c",d', ",")).toEqual([["a", "b,c", "d"]]);
  });

  it("keeps a newline embedded in a quoted field intact, as one record", () => {
    const result = tokenizeCsv('a,"line1\nline2",c', ",");
    expect(result).toEqual([["a", "line1\nline2", "c"]]);
  });

  it("unescapes doubled quotes as a single literal quote", () => {
    expect(tokenizeCsv('"He said ""hi"""', ",")).toEqual([['He said "hi"']]);
  });

  it("treats CRLF as a single record separator", () => {
    expect(tokenizeCsv("a,b\r\nc,d", ",")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("treats a lone LF as a record separator", () => {
    expect(tokenizeCsv("a,b\nc,d", ",")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("treats a lone CR as a record separator", () => {
    expect(tokenizeCsv("a,b\rc,d", ",")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("does not emit a phantom trailing record when content ends with a newline", () => {
    expect(tokenizeCsv("a,b\nc,d\n", ",")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("emits the final record when content has no trailing newline", () => {
    expect(tokenizeCsv("a,b\nc,d", ",")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("handles a single line with no trailing newline at all", () => {
    expect(tokenizeCsv("only,one,line", ",")).toEqual([["only", "one", "line"]]);
  });

  it("returns an empty array for empty content", () => {
    expect(tokenizeCsv("", ",")).toEqual([]);
  });
});

describe("iterateCsvRecords", () => {
  it("yields the same records tokenizeCsv collects", () => {
    const content = "a,b\n1,2\n3,4";
    expect([...iterateCsvRecords(content, ",")]).toEqual(tokenizeCsv(content, ","));
  });

  it("is a generator that can be consumed lazily", () => {
    const generator = iterateCsvRecords("a,b\n1,2\n3,4", ",");
    const first = generator.next();
    expect(first.done).toBe(false);
    expect(first.value).toEqual(["a", "b"]);
  });
});
