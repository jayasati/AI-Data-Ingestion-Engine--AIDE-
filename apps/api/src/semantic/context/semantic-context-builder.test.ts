import { describe, expect, it } from "vitest";
import { buildSemanticContext } from "@/semantic/context/semantic-context-builder";
import type { SemanticAnalysisResult } from "@/semantic/semantic-engine";

function result(mappings: SemanticAnalysisResult["mappings"]): SemanticAnalysisResult {
  return {
    headerProfiles: [],
    columnProfiles: [],
    datasetType: { detectedType: "crm_export", confidence: 0.7, signals: [] },
    confidenceProfiles: [],
    mappings,
    report: {
      datasetType: "crm_export",
      datasetTypeConfidence: 0.7,
      columnsAnalyzed: mappings.length,
      highConfidenceFields: [],
      mediumConfidenceFields: [],
      aiRequiredFields: [],
      unknownColumns: [],
      semanticCoverage: 0,
      averageConfidence: 0,
    },
  };
}

describe("buildSemanticContext", () => {
  it("carries dataset type and confidence through", () => {
    const context = buildSemanticContext(result([]));
    expect(context.datasetType).toBe("crm_export");
    expect(context.datasetTypeConfidence).toBe(0.7);
  });

  it("maps top candidate and alternates per column", () => {
    const context = buildSemanticContext(
      result([
        {
          columnIndex: 0,
          header: "Contact",
          tier: "ai_candidate",
          topCandidate: { fieldId: "phone", confidence: 0.6, evidence: [] },
          candidates: [
            { fieldId: "phone", confidence: 0.6, evidence: [] },
            { fieldId: "email", confidence: 0.2, evidence: [] },
          ],
        },
      ]),
    );
    expect(context.columns[0]).toMatchObject({
      header: "Contact",
      tier: "ai_candidate",
      topCandidateField: "phone",
      topCandidateConfidence: 0.6,
      alternateCandidates: [{ fieldId: "email", confidence: 0.2 }],
    });
  });

  it("reports null topCandidateField and 0 confidence for an unknown column", () => {
    const context = buildSemanticContext(
      result([
        { columnIndex: 0, header: "Mystery", tier: "unknown", topCandidate: null, candidates: [] },
      ]),
    );
    expect(context.columns[0].topCandidateField).toBeNull();
    expect(context.columns[0].topCandidateConfidence).toBe(0);
    expect(context.columns[0].alternateCandidates).toEqual([]);
  });
});
