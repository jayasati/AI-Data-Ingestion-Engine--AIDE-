import { describe, expect, it } from "vitest";
import { optimizeSections } from "@/prompt/optimizer/prompt-optimizer";
import { buildCurrentBatchSection } from "@/prompt/sections/current-batch-section";
import { MockProvider } from "@/ai/providers/mock-provider";
import type { NormalizedField, NormalizedRecord } from "@/pipeline/domain/normalization";

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

describe("optimizeSections", () => {
  it("drops an empty section entirely", () => {
    const result = optimizeSections([
      { id: "negative_examples", text: "" },
      { id: "identity", text: "# Identity\nhello" },
    ]);
    expect(result.sections.map((s) => s.id)).toEqual(["identity"]);
    expect(result.removedSectionIds).toEqual(["negative_examples"]);
  });

  it("drops an exact duplicate section (same id and text)", () => {
    const result = optimizeSections([
      { id: "identity", text: "# Identity\nhello" },
      { id: "identity", text: "# Identity\nhello" },
    ]);
    expect(result.sections).toHaveLength(1);
    expect(result.removedSectionIds).toEqual(["identity"]);
  });

  it("keeps two sections with the same id but different text", () => {
    const result = optimizeSections([
      { id: "examples", text: "Example A" },
      { id: "examples", text: "Example B" },
    ]);
    expect(result.sections).toHaveLength(2);
  });

  it("trims trailing per-line whitespace and collapses 3+ blank lines to 1", () => {
    const result = optimizeSections([{ id: "mission", text: "line one   \n\n\n\nline two" }]);
    expect(result.sections[0].text).toBe("line one\n\nline two");
  });

  it("reports charsRemoved as the total shrinkage", () => {
    const result = optimizeSections([{ id: "mission", text: "line one   \n\n\n\nline two" }]);
    expect(result.charsRemoved).toBeGreaterThan(0);
  });

  it("never corrupts a Current Batch section's JSON — MockProvider can still parse it after optimization", async () => {
    const records: readonly NormalizedRecord[] = [
      { rowNumber: 1, fields: [field("Name", "John Doe")], warnings: [], hasErrors: false },
    ];
    const currentBatchText = buildCurrentBatchSection(records);

    const result = optimizeSections([
      { id: "dataset_context", text: "" },
      { id: "current_batch", text: currentBatchText },
    ]);

    const optimizedCurrentBatch = result.sections.find((s) => s.id === "current_batch");
    expect(optimizedCurrentBatch).toBeDefined();

    const provider = new MockProvider();
    const response = await provider.complete({
      messages: [
        { role: "system", content: "# Identity" },
        { role: "user", content: optimizedCurrentBatch!.text },
      ],
      model: "mock-v1",
      temperature: 0,
      maxTokens: 1000,
      timeoutMs: 1000,
    });
    const parsed = JSON.parse(response.text) as { records: unknown[] };
    expect(parsed.records).toHaveLength(1);
  });
});
