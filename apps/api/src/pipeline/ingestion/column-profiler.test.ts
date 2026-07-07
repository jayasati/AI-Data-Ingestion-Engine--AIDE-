import { describe, expect, it } from "vitest";
import type { ParsedDataset, ParsedRow } from "@/pipeline/domain/parsing";
import { buildColumnProfiles } from "@/pipeline/ingestion/column-profiler";
import { buildHeaderProfiles } from "@/pipeline/ingestion/header-engine";

function toRow(rowNumber: number, cells: readonly string[]): ParsedRow {
  return { rowNumber, rawCells: cells, cells, status: "ok", warnings: [], context: {} };
}

function toDataset(
  headers: readonly string[],
  rowCells: readonly (readonly string[])[],
): ParsedDataset {
  const rows = rowCells.map((cells, index) => toRow(index + 1, cells));
  return {
    headers,
    rows,
    delimiter: ",",
    encoding: "UTF-8",
    rowCount: rows.length,
    columnCount: headers.length,
    headerDuplicateFlags: headers.map(() => false),
  };
}

describe("buildColumnProfiles", () => {
  const headers = ["Name", "Email", "Mixed", "Empty"];
  const dataset = toDataset(headers, [
    ["John Doe", "john@example.com", "abc", ""],
    ["Jane Roe", "jane@example.com", "123", ""],
    ["Amy Lee", "amy@example.com", "xyz", ""],
    ["Bob King", "bob@example.com", "def", ""],
  ]);
  const headerProfiles = buildHeaderProfiles(headers, dataset.headerDuplicateFlags);
  const profiles = buildColumnProfiles(dataset, headerProfiles);

  it("classifies a fully-matching email column as 'email' with confidence 1", () => {
    const email = profiles[1];
    expect(email.dataTypeGuess).toBe("email");
    expect(email.confidenceScore).toBe(1);
    expect(email.detectedPatterns.potentialEmail).toBe(true);
  });

  it("classifies a column with no pattern crossing the 0.5 threshold as 'text' with zero confidence", () => {
    // "Mixed" is 1/4 numeric-looking ("123") = 25%, below the 0.5 threshold,
    // so it must fall through to "text" rather than "numeric".
    const mixed = profiles[2];
    expect(mixed.uniqueValueCount).toBe(4);
    expect(mixed.dataTypeGuess).toBe("text");
    expect(mixed.confidenceScore).toBe(0);
    expect(mixed.detectedPatterns.potentialNumeric).toBe(false);
  });

  it("classifies a fully-empty column as 'empty' with zero confidence", () => {
    const empty = profiles[3];
    expect(empty.dataTypeGuess).toBe("empty");
    expect(empty.confidenceScore).toBe(0);
    expect(empty.missingValueCount).toBe(4);
    expect(empty.nullPercentage).toBe(100);
    expect(empty.detectedPatterns).toEqual({
      potentialEmail: false,
      potentialPhone: false,
      potentialDate: false,
      potentialNumeric: false,
    });
  });

  it("computes nullPercentage as missing/totalRows * 100", () => {
    const headersWithGaps = ["Value"];
    const gappyDataset = toDataset(headersWithGaps, [["1"], [""], ["3"], [""]]);
    const gappyProfiles = buildColumnProfiles(
      gappyDataset,
      buildHeaderProfiles(headersWithGaps, gappyDataset.headerDuplicateFlags),
    );
    expect(gappyProfiles[0].missingValueCount).toBe(2);
    expect(gappyProfiles[0].nullPercentage).toBe(50);
  });

  it("caps sampleValues at 5 distinct values, in order of first appearance", () => {
    const headersForSamples = ["Value"];
    const manyDataset = toDataset(headersForSamples, [
      ["a"],
      ["b"],
      ["a"], // duplicate, should not consume a sample slot
      ["c"],
      ["d"],
      ["e"],
      ["f"],
    ]);
    const sampleProfiles = buildColumnProfiles(
      manyDataset,
      buildHeaderProfiles(headersForSamples, manyDataset.headerDuplicateFlags),
    );
    expect(sampleProfiles[0].sampleValues).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("reports uniqueValueCount based on trimmed distinct non-empty values", () => {
    const headersForUnique = ["Value"];
    const uniqueDataset = toDataset(headersForUnique, [["a"], [" a "], ["b"], ["a"]]);
    const uniqueProfiles = buildColumnProfiles(
      uniqueDataset,
      buildHeaderProfiles(headersForUnique, uniqueDataset.headerDuplicateFlags),
    );
    expect(uniqueProfiles[0].uniqueValueCount).toBe(2); // "a" and "b"
  });

  it("computes averageLength/maxLength/minLength over non-empty trimmed values only", () => {
    const headersForLength = ["Value"];
    const lengthDataset = toDataset(headersForLength, [["ab"], ["abcd"], [""]]);
    const lengthProfiles = buildColumnProfiles(
      lengthDataset,
      buildHeaderProfiles(headersForLength, lengthDataset.headerDuplicateFlags),
    );
    expect(lengthProfiles[0].minLength).toBe(2);
    expect(lengthProfiles[0].maxLength).toBe(4);
    expect(lengthProfiles[0].averageLength).toBe(3);
  });

  it("carries the header profile's originalHeader/normalizedHeader/isDuplicateHeader through", () => {
    const name = profiles[0];
    expect(name.originalHeader).toBe("Name");
    expect(name.normalizedHeader).toBe("name");
    expect(name.isDuplicateHeader).toBe(false);
  });
});
