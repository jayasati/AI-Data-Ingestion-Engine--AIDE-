import { describe, expect, it } from "vitest";
import { selectExamples } from "@/ai/prompt/example-registry";
import type { DatasetContext } from "@/ai/context/dataset-context-builder";

function contextWithHeaders(headers: readonly string[]): DatasetContext {
  return {
    totalRecords: 1,
    headers,
    columns: headers.map((header) => ({
      header,
      detectedTypeHint: null,
      sampleValues: [],
      nullRatio: 0,
    })),
  };
}

describe("selectExamples", () => {
  it("ranks the real-estate category highest for headers matching its hints", () => {
    const context = contextWithHeaders(["Customer", "Email Address", "Possession", "Project"]);
    const selected = selectExamples(context, 2);
    expect(selected[0].category).toBe("real-estate");
  });

  it("ranks the marketing-agency category highest for headers matching its hints", () => {
    const context = contextWithHeaders(["Lead", "Remarks", "Source Campaign"]);
    const selected = selectExamples(context, 3);
    expect(selected[0].category).toBe("marketing-agency");
  });

  it("ranks crm-export highest for headers matching Owner/Status/Mail ID", () => {
    const context = contextWithHeaders(["Contact Name", "Mail ID", "Owner", "Status"]);
    const selected = selectExamples(context, 2);
    expect(selected[0].category).toBe("crm-export");
  });

  it("matching is case-insensitive", () => {
    const context = contextWithHeaders(["POSSESSION", "PROJECT"]);
    const selected = selectExamples(context, 1);
    expect(selected[0].category).toBe("real-estate");
  });

  it("falls back to the first `limit` examples when nothing scores above zero", () => {
    const context = contextWithHeaders(["Column A", "Column B", "Column C"]);
    const selected = selectExamples(context, 3);
    expect(selected).toHaveLength(3);
  });

  it("never returns more than `limit` examples", () => {
    const context = contextWithHeaders(["Full Name", "Campaign Name", "Created Time"]);
    const selected = selectExamples(context, 2);
    expect(selected.length).toBeLessThanOrEqual(2);
  });

  it("defaults to a limit of 2 when none is passed", () => {
    const context = contextWithHeaders(["Column A"]);
    const selected = selectExamples(context);
    expect(selected.length).toBeLessThanOrEqual(2);
  });

  it("returns limit examples even with an empty header list", () => {
    const context = contextWithHeaders([]);
    const selected = selectExamples(context, 2);
    expect(selected).toHaveLength(2);
  });
});
