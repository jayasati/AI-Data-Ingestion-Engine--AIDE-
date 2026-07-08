import { describe, expect, it } from "vitest";
import { analyzeSemantics } from "@/semantic/semantic-engine";
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

function field(header: string, value: string | null): NormalizedField {
  return {
    header,
    originalValue: value ?? "",
    normalizedValue: value,
    appliedRules: [],
    warnings: [],
    status: "unchanged",
    confidence: 1,
  };
}

function dataset(
  headers: readonly string[],
  rows: ReadonlyArray<readonly (string | null)[]>,
): NormalizedDataset {
  const records: NormalizedRecord[] = rows.map((cells, index) => ({
    rowNumber: index + 1,
    fields: headers.map((h, i) => field(h, cells[i])),
    warnings: [],
    hasErrors: false,
  }));
  return { headers, records, recordCount: rows.length, report: EMPTY_REPORT };
}

describe("analyzeSemantics", () => {
  it("maps an exact-alias, value-confirmed header to the deterministic tier", () => {
    const result = analyzeSemantics(
      dataset(["Email Address"], [["a@x.com"], ["b@x.com"], ["c@x.com"], ["d@x.com"], ["e@x.com"]]),
    );
    const [mapping] = result.mappings;
    expect(mapping.tier).toBe("deterministic");
    expect(mapping.topCandidate?.fieldId).toBe("email");
  });

  it("resolves an ambiguous header purely from its values (phone, not email or name)", () => {
    const result = analyzeSemantics(
      dataset(["Contact"], [["9876543210"], ["9988776655"], ["9123456780"], ["9001122334"]]),
    );
    const [mapping] = result.mappings;
    expect(mapping.topCandidate?.fieldId).toBe("phone");
  });

  it("routes a header with no header or value evidence to unknown", () => {
    const result = analyzeSemantics(dataset(["Zzyzx"], [[null], [null]]));
    expect(result.mappings[0].tier).toBe("unknown");
  });

  it("produces a coherent semantic report", () => {
    const result = analyzeSemantics(
      dataset(
        ["Email Address", "Zzyzx"],
        [
          ["a@x.com", null],
          ["b@x.com", null],
        ],
      ),
    );
    expect(result.report.columnsAnalyzed).toBe(2);
    expect(result.report.highConfidenceFields).toHaveLength(1);
    expect(result.report.unknownColumns).toHaveLength(1);
  });

  it("detects a real-estate-flavored dataset type from header vocabulary", () => {
    const result = analyzeSemantics(
      dataset(
        ["Customer", "Email Address", "Possession", "Tower"],
        [["A", "a@x.com", "Ready", "T1"]],
      ),
    );
    expect(result.datasetType.detectedType).toBe("real_estate");
  });

  it("does not deterministically map a form/campaign-name column to 'name' just from Title-Case shape", () => {
    // Regression case found via live testing: "form_name" full of values like
    // "Site Visit Request" previously noisy-OR'd (header fuzzy-match on the
    // shared "_name" suffix + a too-permissive nameClassifier + a
    // high-uniqueness statistical confirm) to >85% confidence for "name",
    // wrongly landing in the deterministic (no-AI) tier.
    const result = analyzeSemantics(
      dataset(
        ["form_name"],
        [
          ["3BHK Interest Form"],
          ["Site Visit Request"],
          ["Brochure Download"],
          ["3BHK Interest Form"],
          ["Callback Request"],
        ],
      ),
    );
    const [mapping] = result.mappings;
    expect(mapping.tier).not.toBe("deterministic");
  });

  it("is deterministic across repeated calls on the same dataset (no hidden state)", () => {
    const input = dataset(["Email Address"], [["a@x.com"], ["b@x.com"]]);
    const first = analyzeSemantics(input);
    const second = analyzeSemantics(input);
    expect(first.report).toEqual(second.report);
  });
});
