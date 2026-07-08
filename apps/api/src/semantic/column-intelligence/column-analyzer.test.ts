import { describe, expect, it } from "vitest";
import { analyzeColumns } from "@/semantic/column-intelligence/column-analyzer";
import type {
  NormalizationReport,
  NormalizedDataset,
  NormalizedField,
  NormalizedRecord,
} from "@/pipeline/domain/normalization";

const EMPTY_REPORT: NormalizationReport = {
  totalFields: 0,
  whitespaceNormalizedCount: 0,
  unicodeNormalizedCount: 0,
  nullValuesDetected: 0,
  emailsNormalized: 0,
  invalidEmails: 0,
  phonesNormalized: 0,
  invalidPhones: 0,
  datesParsed: 0,
  failedDateParses: 0,
  numbersNormalized: 0,
  booleansNormalized: 0,
  fieldsWithWarnings: 0,
  fieldsFailed: 0,
};

function field(header: string, normalizedValue: string | null): NormalizedField {
  return {
    header,
    originalValue: normalizedValue ?? "",
    normalizedValue,
    appliedRules: [],
    warnings: [],
    status: "unchanged",
    confidence: 1,
  };
}

function record(rowNumber: number, fields: readonly NormalizedField[]): NormalizedRecord {
  return { rowNumber, fields, warnings: [], hasErrors: false };
}

function dataset(
  headers: readonly string[],
  rows: ReadonlyArray<readonly (string | null)[]>,
): NormalizedDataset {
  return {
    headers,
    records: rows.map((cells, index) =>
      record(
        index + 1,
        headers.map((h, i) => field(h, cells[i])),
      ),
    ),
    recordCount: rows.length,
    report: EMPTY_REPORT,
  };
}

describe("analyzeColumns", () => {
  it("flags an email-heavy column as likelyEmail", () => {
    const [profile] = analyzeColumns(dataset(["Contact"], [["a@x.com"], ["b@x.com"], ["c@x.com"]]));
    expect(profile.likelyEmail).toBe(true);
    expect(profile.likelyPhone).toBe(false);
    expect(profile.regexSignals.email?.matchRatio).toBe(1);
  });

  it("flags a phone-heavy column as likelyPhone, not email", () => {
    const [profile] = analyzeColumns(dataset(["Contact"], [["9876543210"], ["9988776655"]]));
    expect(profile.likelyPhone).toBe(true);
    expect(profile.likelyEmail).toBe(false);
  });

  it("computes uniqueness ratio and null percentage", () => {
    const [profile] = analyzeColumns(dataset(["Status"], [["New"], ["New"], [null], ["Closed"]]));
    expect(profile.nonEmptyCount).toBe(3);
    expect(profile.uniqueValueCount).toBe(2);
    expect(profile.uniquenessRatio).toBeCloseTo(2 / 3);
    expect(profile.nullPercentage).toBe(25);
  });

  it("returns all-zero stats for an entirely empty column", () => {
    const [profile] = analyzeColumns(dataset(["Notes"], [[null], [null]]));
    expect(profile.nonEmptyCount).toBe(0);
    expect(profile.uniquenessRatio).toBe(0);
    expect(profile.averageLength).toBe(0);
    expect(profile.entropy).toBe(0);
    expect(profile.nullPercentage).toBe(100);
  });

  it("produces one profile per header, in header order", () => {
    const profiles = analyzeColumns(dataset(["A", "B"], [["1", "2"]]));
    expect(profiles.map((p) => p.header)).toEqual(["A", "B"]);
  });
});
