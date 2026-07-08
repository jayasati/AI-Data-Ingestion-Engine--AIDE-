import { describe, expect, it } from "vitest";
import { attemptJsonRepair } from "@/trust/parser/json-repair";

describe("attemptJsonRepair", () => {
  it("removes a trailing comma before a closing brace", () => {
    const result = attemptJsonRepair('{"a": 1, "b": 2,}');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ a: 1, b: 2 });
    expect(result.repairsApplied).toContain("TRAILING_COMMA_REMOVED");
  });

  it("removes a trailing comma before a closing bracket", () => {
    const result = attemptJsonRepair('{"records": [1, 2, 3,]}');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ records: [1, 2, 3] });
  });

  it("does not strip a comma that legitimately appears inside a string value", () => {
    const result = attemptJsonRepair('{"note": "a, b, c", "x": 1,}');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ note: "a, b, c", x: 1 });
  });

  it("normalizes smart/curly quotes to straight quotes", () => {
    const smart = `{“a”: “1”}`;
    const result = attemptJsonRepair(smart);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ a: "1" });
    expect(result.repairsApplied).toContain("SMART_QUOTES_NORMALIZED");
  });

  it("closes an unbalanced/truncated object", () => {
    const result = attemptJsonRepair('{"records": [{"row": 1, "fields": {"name": "John');
    expect(result.success).toBe(true);
    expect(result.repairsApplied).toContain("UNTERMINATED_STRING_CLOSED");
    expect(result.repairsApplied).toContain("UNBALANCED_BRACKETS_CLOSED");
  });

  it("quotes an unquoted object key", () => {
    const result = attemptJsonRepair('{name: "John Doe", "age": 30}');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: "John Doe", age: 30 });
    expect(result.repairsApplied).toContain("UNQUOTED_KEY_QUOTED");
  });

  it("fixes an invalid escape sequence inside a string", () => {
    const result = attemptJsonRepair('{"path": "C:\\Users\\x"}');
    expect(result.success).toBe(true);
    expect(result.repairsApplied).toContain("INVALID_ESCAPE_FIXED");
  });

  it("escapes a raw newline inside a string", () => {
    const result = attemptJsonRepair('{"note": "line one\nline two"}');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ note: "line one\nline two" });
    expect(result.repairsApplied).toContain("CONTROL_CHARACTER_ESCAPED");
  });

  it("combines multiple repairs in a single pass", () => {
    const broken = `{name: “John”, "tags": ["a", "b",],}`;
    const result = attemptJsonRepair(broken);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: "John", tags: ["a", "b"] });
    expect(result.repairsApplied.length).toBeGreaterThan(1);
  });

  it("reports failure (no-op) for text that is already valid JSON", () => {
    const result = attemptJsonRepair('{"a": 1}');
    expect(result.success).toBe(false);
    expect(result.repairsApplied).toEqual([]);
  });

  it("reports failure when the text is not recoverable even after every repair pass", () => {
    const result = attemptJsonRepair("this is just prose, not JSON at all");
    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
  });

  it("returns the repaired text alongside the parsed data on success", () => {
    const result = attemptJsonRepair('{"a": 1,}');
    expect(result.repairedText).toBe('{"a": 1}');
  });
});
