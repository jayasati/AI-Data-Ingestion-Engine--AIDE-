import { describe, expect, it } from "vitest";
import { buildDatasetContext } from "@/ai/context/dataset-context-builder";
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

function field(
  header: string,
  normalizedValue: string | null,
  kind?: "email" | "phone" | "date" | "number" | "boolean",
): NormalizedField {
  return {
    header,
    originalValue: normalizedValue ?? "",
    normalizedValue,
    appliedRules: [],
    warnings: [],
    status: "unchanged",
    confidence: 1,
    details:
      kind === "email"
        ? { kind: "email", primary: normalizedValue ?? "", additional: [], isValid: true }
        : kind === "phone"
          ? {
              kind: "phone",
              e164: normalizedValue,
              countryCode: null,
              nationalNumber: normalizedValue ?? "",
              raw: normalizedValue ?? "",
              additional: [],
            }
          : kind === "date"
            ? { kind: "date", iso: normalizedValue, matchedFormat: null }
            : kind === "number"
              ? {
                  kind: "number",
                  value: normalizedValue ? Number(normalizedValue) : null,
                  currencySymbol: null,
                  isPercentage: false,
                }
              : kind === "boolean"
                ? { kind: "boolean", value: normalizedValue === "true" }
                : undefined,
  };
}

function record(rowNumber: number, fields: readonly NormalizedField[]): NormalizedRecord {
  return { rowNumber, fields, warnings: [], hasErrors: false };
}

describe("buildDatasetContext", () => {
  it("builds one column summary per header, in header order", () => {
    const dataset: NormalizedDataset = {
      headers: ["Email", "Phone"],
      records: [
        record(1, [
          field("Email", "john@example.com", "email"),
          field("Phone", "9876543210", "phone"),
        ]),
      ],
      recordCount: 1,
      report: EMPTY_REPORT,
    };

    const context = buildDatasetContext(dataset);
    expect(context.totalRecords).toBe(1);
    expect(context.headers).toEqual(["Email", "Phone"]);
    expect(context.columns).toHaveLength(2);
    expect(context.columns[0].header).toBe("Email");
    expect(context.columns[1].header).toBe("Phone");
  });

  it("sets detectedTypeHint to the majority-vote kind across the column", () => {
    const dataset: NormalizedDataset = {
      headers: ["Contact"],
      records: [
        record(1, [field("Contact", "a@example.com", "email")]),
        record(2, [field("Contact", "b@example.com", "email")]),
        record(3, [field("Contact", "9876543210", "phone")]),
      ],
      recordCount: 3,
      report: EMPTY_REPORT,
    };

    const context = buildDatasetContext(dataset);
    expect(context.columns[0].detectedTypeHint).toBe("email");
  });

  it("leaves detectedTypeHint null when no cell in the column carries details", () => {
    const dataset: NormalizedDataset = {
      headers: ["Notes"],
      records: [record(1, [field("Notes", "just some text")])],
      recordCount: 1,
      report: EMPTY_REPORT,
    };

    const context = buildDatasetContext(dataset);
    expect(context.columns[0].detectedTypeHint).toBeNull();
  });

  it("caps sampleValues at 5 and de-duplicates them", () => {
    const dataset: NormalizedDataset = {
      headers: ["Value"],
      records: [
        record(1, [field("Value", "a")]),
        record(2, [field("Value", "a")]),
        record(3, [field("Value", "b")]),
        record(4, [field("Value", "c")]),
        record(5, [field("Value", "d")]),
        record(6, [field("Value", "e")]),
        record(7, [field("Value", "f")]),
      ],
      recordCount: 7,
      report: EMPTY_REPORT,
    };

    const context = buildDatasetContext(dataset);
    expect(context.columns[0].sampleValues).toHaveLength(5);
    expect(context.columns[0].sampleValues).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("computes nullRatio as nullCount / recordCount", () => {
    const dataset: NormalizedDataset = {
      headers: ["Value"],
      records: [
        record(1, [field("Value", null)]),
        record(2, [field("Value", null)]),
        record(3, [field("Value", "x")]),
        record(4, [field("Value", "y")]),
      ],
      recordCount: 4,
      report: EMPTY_REPORT,
    };

    const context = buildDatasetContext(dataset);
    expect(context.columns[0].nullRatio).toBe(0.5);
  });

  it("returns nullRatio 0 for an empty dataset (guards against division by zero)", () => {
    const dataset: NormalizedDataset = {
      headers: ["Value"],
      records: [],
      recordCount: 0,
      report: EMPTY_REPORT,
    };

    const context = buildDatasetContext(dataset);
    expect(context.columns[0].nullRatio).toBe(0);
    expect(context.columns[0].sampleValues).toHaveLength(0);
  });
});
