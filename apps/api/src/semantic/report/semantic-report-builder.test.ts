import { describe, expect, it } from "vitest";
import { buildSemanticReport } from "@/semantic/report/semantic-report-builder";
import type { DatasetTypeResult } from "@/semantic/dataset-intelligence/dataset-type-detector";
import type { HybridMappingEntry } from "@/semantic/mapping/hybrid-mapper";

const DATASET_TYPE: DatasetTypeResult = {
  detectedType: "crm_export",
  confidence: 0.8,
  signals: [],
};

function entry(tier: HybridMappingEntry["tier"], confidence: number | null): HybridMappingEntry {
  return {
    columnIndex: 0,
    header: "h",
    tier,
    topCandidate: confidence === null ? null : { fieldId: "email", confidence, evidence: [] },
    candidates: [],
  };
}

describe("buildSemanticReport", () => {
  it("buckets mappings by tier", () => {
    const report = buildSemanticReport(DATASET_TYPE, [
      entry("deterministic", 0.9),
      entry("ai_candidate", 0.6),
      entry("ai_required", 0.2),
      entry("unknown", null),
    ]);
    expect(report.highConfidenceFields).toHaveLength(1);
    expect(report.mediumConfidenceFields).toHaveLength(1);
    expect(report.aiRequiredFields).toHaveLength(1);
    expect(report.unknownColumns).toHaveLength(1);
    expect(report.columnsAnalyzed).toBe(4);
  });

  it("computes semanticCoverage as (deterministic + ai_candidate) / total", () => {
    const report = buildSemanticReport(DATASET_TYPE, [
      entry("deterministic", 0.9),
      entry("ai_candidate", 0.6),
      entry("ai_required", 0.2),
      entry("unknown", null),
    ]);
    expect(report.semanticCoverage).toBeCloseTo(0.5);
  });

  it("computes averageConfidence over all columns, treating unknown as 0", () => {
    const report = buildSemanticReport(DATASET_TYPE, [
      entry("deterministic", 1),
      entry("unknown", null),
    ]);
    expect(report.averageConfidence).toBeCloseTo(0.5);
  });

  it("returns zeroed aggregates for an empty mapping list", () => {
    const report = buildSemanticReport(DATASET_TYPE, []);
    expect(report.semanticCoverage).toBe(0);
    expect(report.averageConfidence).toBe(0);
    expect(report.columnsAnalyzed).toBe(0);
  });

  it("carries the dataset type and its confidence through unchanged", () => {
    const report = buildSemanticReport(DATASET_TYPE, []);
    expect(report.datasetType).toBe("crm_export");
    expect(report.datasetTypeConfidence).toBe(0.8);
  });
});
