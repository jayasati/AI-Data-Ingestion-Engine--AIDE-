import { describe, expect, it } from "vitest";
import { parseAIResponse } from "@/ai/response/response-parser";

describe("parseAIResponse", () => {
  it("fails on an empty string with an EMPTY_RESPONSE diagnostic", () => {
    const result = parseAIResponse("");
    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("EMPTY_RESPONSE");
  });

  it("fails on a whitespace-only string with an EMPTY_RESPONSE diagnostic", () => {
    const result = parseAIResponse("   \n\t  ");
    expect(result.success).toBe(false);
    expect(result.diagnostics[0].code).toBe("EMPTY_RESPONSE");
  });

  it("parses plain valid JSON with no diagnostics", () => {
    const result = parseAIResponse('{"records":[]}');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ records: [] });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("strips a ```json fence and parses the inner JSON", () => {
    const raw = '```json\n{"records":[]}\n```';
    const result = parseAIResponse(raw);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ records: [] });
    expect(result.diagnostics.map((d) => d.code)).toContain("MARKDOWN_CODE_BLOCK_STRIPPED");
  });

  it("strips a plain ``` fence (no language tag) and parses the inner JSON", () => {
    const raw = '```\n{"records":[]}\n```';
    const result = parseAIResponse(raw);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ records: [] });
    expect(result.diagnostics.map((d) => d.code)).toContain("MARKDOWN_CODE_BLOCK_STRIPPED");
  });

  it("strips surrounding prose and parses the embedded JSON", () => {
    const raw = 'Here is the result: {"records":[]} Let me know if you need anything else.';
    const result = parseAIResponse(raw);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ records: [] });
    expect(result.diagnostics.map((d) => d.code)).toContain("SURROUNDING_TEXT_STRIPPED");
  });

  it("fails on malformed/truncated JSON with a JSON_PARSE_FAILED diagnostic", () => {
    const result = parseAIResponse('{"records": [ { "row": 1, ');
    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.diagnostics.map((d) => d.code)).toContain("JSON_PARSE_FAILED");
  });

  it("preserves rawText even on failure", () => {
    const raw = "not json at all";
    const result = parseAIResponse(raw);
    expect(result.rawText).toBe(raw);
  });

  it("handles a JSON array response (isolateJsonSubstring supports [ ] too)", () => {
    const raw = "Sure, here you go: [1,2,3] thanks";
    const result = parseAIResponse(raw);
    expect(result.success).toBe(true);
    expect(result.data).toEqual([1, 2, 3]);
  });
});
