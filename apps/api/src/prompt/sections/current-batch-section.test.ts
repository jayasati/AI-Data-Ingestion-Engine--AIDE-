import { describe, expect, it } from "vitest";
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

const RECORDS: readonly NormalizedRecord[] = [
  {
    rowNumber: 1,
    fields: [field("Full Name", "John Doe"), field("Email", "john@example.com")],
    warnings: [],
    hasErrors: false,
  },
  {
    rowNumber: 2,
    fields: [field("Full Name", "Jane Roe"), field("Email", null)],
    warnings: [],
    hasErrors: false,
  },
];

describe("buildCurrentBatchSection", () => {
  it("starts with the '# Current Batch' marker MockProvider scans for", () => {
    const section = buildCurrentBatchSection(RECORDS);
    expect(section.startsWith("# Current Batch")).toBe(true);
  });

  it("embeds row/cells JSON reflecting every record's header->value map", () => {
    const section = buildCurrentBatchSection(RECORDS);
    expect(section).toContain('"row": 1');
    expect(section).toContain('"Full Name": "John Doe"');
    expect(section).toContain('"Email": null');
  });

  it("is byte-compatible with MockProvider's batch parser end-to-end", async () => {
    const section = buildCurrentBatchSection(RECORDS);
    const provider = new MockProvider();
    const response = await provider.complete({
      messages: [
        { role: "system", content: "# Identity\nyou are an extractor" },
        { role: "user", content: `# Dataset Context\nsome context\n\n${section}` },
      ],
      model: "mock-v1",
      temperature: 0,
      maxTokens: 1000,
      timeoutMs: 1000,
    });

    const parsed = JSON.parse(response.text) as { records: Array<{ row: number }> };
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[0].row).toBe(1);
    expect(parsed.records[1].row).toBe(2);
  });
});
