import { describe, expect, it } from "vitest";
import { isBlankRecord, reconcileRowLength } from "@/pipeline/stages/csv-parsing/row-reconciler";

describe("isBlankRecord", () => {
  it("is true when every cell is an empty string", () => {
    expect(isBlankRecord(["", "", ""])).toBe(true);
  });

  it("is true when every cell is whitespace-only", () => {
    expect(isBlankRecord(["  ", "", "\t"])).toBe(true);
  });

  it("is false when any cell has content", () => {
    expect(isBlankRecord(["", "value", ""])).toBe(false);
  });

  it("is true for an empty record (vacuous every)", () => {
    expect(isBlankRecord([])).toBe(true);
  });
});

describe("reconcileRowLength", () => {
  it("pads a short row with empty strings", () => {
    expect(reconcileRowLength(["a", "b"], 4)).toEqual(["a", "b", "", ""]);
  });

  it("truncates a long row", () => {
    expect(reconcileRowLength(["a", "b", "c", "d"], 2)).toEqual(["a", "b"]);
  });

  it("returns the identical array reference when the length already matches", () => {
    const cells = ["a", "b", "c"];
    expect(reconcileRowLength(cells, 3)).toBe(cells);
  });

  it("does not return the identical reference when padding is needed", () => {
    const cells = ["a"];
    expect(reconcileRowLength(cells, 2)).not.toBe(cells);
  });

  it("does not return the identical reference when truncation is needed", () => {
    const cells = ["a", "b", "c"];
    expect(reconcileRowLength(cells, 1)).not.toBe(cells);
  });

  it("handles reconciling to zero columns", () => {
    expect(reconcileRowLength(["a", "b"], 0)).toEqual([]);
  });
});
