import { describe, expect, it } from "vitest";
import { buildDatasetContextSection } from "@/ai/prompt/prompt-sections";
import type { DatasetContext } from "@/ai/context/dataset-context-builder";

const BASE_CONTEXT: DatasetContext = {
  totalRecords: 1,
  headers: ["Contact"],
  columns: [{ header: "Contact", detectedTypeHint: null, sampleValues: [], nullRatio: 0 }],
};

describe("buildDatasetContextSection", () => {
  it("omits semantic intelligence content when no semantics are supplied (backward compatible)", () => {
    const section = buildDatasetContextSection(BASE_CONTEXT);
    expect(section).not.toContain("Detected dataset type");
    expect(section).not.toContain("Semantic field hints");
  });

  it("injects dataset type and per-column hints when semantics are present", () => {
    const section = buildDatasetContextSection({
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
    });
    expect(section).toContain("Detected dataset type: crm_export (80% confidence)");
    expect(section).toContain('"Contact": likely "phone" (60%)');
    expect(section).toContain("also consider: email (20%)");
  });

  it("skips deterministic-tier columns from the injected hints entirely", () => {
    const section = buildDatasetContextSection({
      ...BASE_CONTEXT,
      semantics: {
        datasetType: "crm_export",
        datasetTypeConfidence: 0.8,
        columns: [
          {
            header: "Email",
            tier: "deterministic",
            topCandidateField: "email",
            topCandidateConfidence: 0.99,
            alternateCandidates: [],
          },
        ],
      },
    });
    expect(section).not.toContain("Semantic field hints");
    expect(section).not.toContain("Email");
  });
});
