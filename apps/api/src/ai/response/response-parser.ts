import type { ParserDiagnostic } from "@/ai/contracts/execution";

export interface ParsedAIResponse {
  readonly success: boolean;
  readonly data: unknown;
  readonly diagnostics: readonly ParserDiagnostic[];
  readonly rawText: string;
}

const CODE_BLOCK_PATTERN = /```(?:json)?\s*([\s\S]*?)```/i;

function stripMarkdownCodeBlock(text: string, diagnostics: ParserDiagnostic[]): string {
  const match = CODE_BLOCK_PATTERN.exec(text);
  if (!match) {
    return text;
  }
  diagnostics.push({
    code: "MARKDOWN_CODE_BLOCK_STRIPPED",
    message: "Removed a markdown code fence around the JSON payload.",
  });
  return match[1].trim();
}

function isolateJsonSubstring(text: string, diagnostics: ParserDiagnostic[]): string {
  if (text.startsWith("{") || text.startsWith("[")) {
    return text;
  }

  const firstObjectIndex = text.indexOf("{");
  const firstArrayIndex = text.indexOf("[");
  const candidates = [firstObjectIndex, firstArrayIndex].filter((index) => index >= 0);
  if (candidates.length === 0) {
    return text;
  }

  const start = Math.min(...candidates);
  const openChar = text[start];
  const closeChar = openChar === "{" ? "}" : "]";
  const end = text.lastIndexOf(closeChar);
  if (end === -1 || end < start) {
    return text;
  }

  diagnostics.push({
    code: "SURROUNDING_TEXT_STRIPPED",
    message: "Removed prose surrounding the JSON payload.",
  });
  return text.slice(start, end + 1);
}

/**
 * Extracts and parses JSON from raw LLM text. Handles markdown code fences,
 * surrounding prose, and malformed JSON deterministically. Deliberately
 * never attempts to *fix* invalid JSON (no bracket-balancing, no
 * trailing-comma removal) — that repair step is explicitly out of scope
 * this volume. On failure, `rawText` and `diagnostics` are exactly what a
 * future repair step would need to pick up from.
 */
export function parseAIResponse(rawText: string): ParsedAIResponse {
  const diagnostics: ParserDiagnostic[] = [];
  const trimmed = rawText.trim();

  if (trimmed.length === 0) {
    diagnostics.push({
      code: "EMPTY_RESPONSE",
      message: "The provider returned an empty response.",
    });
    return { success: false, data: null, diagnostics, rawText };
  }

  const withoutCodeBlock = stripMarkdownCodeBlock(trimmed, diagnostics);
  const candidate = isolateJsonSubstring(withoutCodeBlock, diagnostics);

  try {
    const data: unknown = JSON.parse(candidate);
    return { success: true, data, diagnostics, rawText };
  } catch (error) {
    diagnostics.push({
      code: "JSON_PARSE_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
    return { success: false, data: null, diagnostics, rawText };
  }
}
