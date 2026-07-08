import { describe, expect, it } from "vitest";
import {
  INJECTION_DEFENSE_STATEMENT,
  UNTRUSTED_DATA_BEGIN_MARKER,
  UNTRUSTED_DATA_END_MARKER,
  wrapUntrustedBatchPayload,
} from "@/prompt/security/injection-defense";

describe("injection-defense markers", () => {
  it("contain no braces, so they can never corrupt MockProvider's brace scan", () => {
    expect(UNTRUSTED_DATA_BEGIN_MARKER).not.toMatch(/[{}]/);
    expect(UNTRUSTED_DATA_END_MARKER).not.toMatch(/[{}]/);
  });
});

describe("INJECTION_DEFENSE_STATEMENT", () => {
  it("never mentions the literal '# Current Batch' heading text", () => {
    // Regression: this statement lives in the Business Rules section, which
    // compiles *before* the real Current Batch section. MockProvider finds
    // "# Current Batch" via a plain substring search, so an earlier mention
    // of that exact heading anywhere upstream corrupts its batch scan —
    // caught only by compiling a full prompt and running MockProvider
    // against it end-to-end, not by testing this string in isolation.
    expect(INJECTION_DEFENSE_STATEMENT).not.toContain("# Current Batch");
  });
});

describe("wrapUntrustedBatchPayload", () => {
  it("fences the payload between the begin/end markers, payload untouched", () => {
    const payload = '{"rows":[{"row":1,"cells":{"a":"b"}}]}';
    const wrapped = wrapUntrustedBatchPayload(payload);
    expect(wrapped).toBe(
      [UNTRUSTED_DATA_BEGIN_MARKER, payload, UNTRUSTED_DATA_END_MARKER].join("\n"),
    );
    expect(wrapped.indexOf(payload)).toBeGreaterThan(wrapped.indexOf(UNTRUSTED_DATA_BEGIN_MARKER));
    expect(wrapped.lastIndexOf("}")).toBe(wrapped.indexOf(payload) + payload.lastIndexOf("}"));
  });
});
