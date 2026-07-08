import { describe, expect, it } from "vitest";
import { buildDatasetContextSection } from "@/prompt/sections/dataset-context-section";
import type { DatasetContext } from "@/ai/context/dataset-context-builder";
import type { NormalizationReport } from "@/pipeline/domain/normalization";
import type { ColumnSemanticProfile } from "@/semantic/column-intelligence/column-analyzer";

const EMPTY_REPORT: NormalizationReport = {
  totalFields: 10,
  whitespaceNormalizedCount: 0,
  unicodeNormalizedCount: 0,
  nullValuesDetected: 1,
  emailsNormalized: 5,
  invalidEmails: 0,
  phonesNormalized: 4,
  invalidPhones: 1,
  datesParsed: 3,
  failedDateParses: 0,
  numbersNormalized: 0,
  booleansNormalized: 0,
  fieldsWithWarnings: 1,
  fieldsFailed: 0,
};

const BASE_CONTEXT: DatasetContext = {
  totalRecords: 5,
  headers: ["Contact"],
  columns: [
    { header: "Contact", detectedTypeHint: "phone", sampleValues: ["9876543210"], nullRatio: 0 },
  ],
};

describe("buildDatasetContextSection", () => {
  it("includes the record count and per-column type hint/samples/null%", () => {
    const section = buildDatasetContextSection({
      datasetContext: BASE_CONTEXT,
      normalizationReport: EMPTY_REPORT,
    });
    expect(section).toContain("5 record(s) total.");
    expect(section).toContain('"Contact" — looks like phone (e.g. 9876543210), 0% empty');
  });

  it("summarizes the normalization report", () => {
    const section = buildDatasetContextSection({
      datasetContext: BASE_CONTEXT,
      normalizationReport: EMPTY_REPORT,
    });
    expect(section).toContain("10 field(s) processed");
    expect(section).toContain("5 email(s) (0 invalid)");
    expect(section).toContain("4 phone(s) (1 without a determinable country)");
  });

  it("omits dataset type and semantic mapping lines when no semantics are present", () => {
    const section = buildDatasetContextSection({
      datasetContext: BASE_CONTEXT,
      normalizationReport: EMPTY_REPORT,
    });
    expect(section).not.toContain("Detected dataset type");
    expect(section).not.toContain("Semantic mapping candidate");
  });

  it("includes dataset type and a semantic mapping candidate for non-deterministic columns", () => {
    const context: DatasetContext = {
      ...BASE_CONTEXT,
      semantics: {
        datasetType: "crm_export",
        datasetTypeConfidence: 0.8,
        columns: [
          {
            header: "Contact",
            tier: "ai_candidate",
            topCandidateField: "phone",
            topCandidateConfidence: 0.6,
            alternateCandidates: [{ fieldId: "email", confidence: 0.2 }],
          },
        ],
      },
    };
    const section = buildDatasetContextSection({
      datasetContext: context,
      normalizationReport: EMPTY_REPORT,
    });
    expect(section).toContain("Detected dataset type: crm_export (80% confidence)");
    expect(section).toContain('Semantic mapping candidate: "phone" (60%, ai_candidate)');
    expect(section).toContain("also consider: email (20%)");
  });

  it("skips the semantic mapping line for a deterministic-tier column", () => {
    const context: DatasetContext = {
      ...BASE_CONTEXT,
      semantics: {
        datasetType: "crm_export",
        datasetTypeConfidence: 0.8,
        columns: [
          {
            header: "Contact",
            tier: "deterministic",
            topCandidateField: "phone",
            topCandidateConfidence: 0.99,
            alternateCandidates: [],
          },
        ],
      },
    };
    const section = buildDatasetContextSection({
      datasetContext: context,
      normalizationReport: EMPTY_REPORT,
    });
    expect(section).not.toContain("Semantic mapping candidate");
  });

  it("appends column statistics when columnProfiles are supplied", () => {
    const profile: ColumnSemanticProfile = {
      columnIndex: 0,
      header: "Contact",
      nonEmptyCount: 5,
      uniqueValueCount: 5,
      uniquenessRatio: 1,
      nullPercentage: 0,
      averageLength: 10,
      entropy: 0.9,
      likelyEmail: false,
      likelyPhone: true,
      likelyDate: false,
      likelyCurrency: false,
      likelyName: false,
      likelyCompany: false,
      likelyLocation: false,
      regexSignals: {},
      patternSignals: {},
      locationSignal: { matchRatio: 0, evidence: [] },
    };
    const section = buildDatasetContextSection({
      datasetContext: BASE_CONTEXT,
      normalizationReport: EMPTY_REPORT,
      columnProfiles: [profile],
    });
    expect(section).toContain("100% unique, entropy 0.90");
  });
});
