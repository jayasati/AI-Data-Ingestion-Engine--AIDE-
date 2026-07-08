import { CRM_OUTPUT_FIELDS, type CrmOutputField } from "@/ai/schema/crm-output-schema";
import {
  looksLikeDate,
  looksLikeEmail,
  looksLikePhone,
} from "@/pipeline/ingestion/pattern-detectors";
import type {
  AIRequest,
  AIResponse,
  LLMProvider,
  ProviderCapabilities,
} from "@/ai/contracts/llm-provider";

interface MockBatchRow {
  readonly row: number;
  readonly cells: Readonly<Record<string, string | null>>;
}

const CAPABILITIES: ProviderCapabilities = {
  supportsJsonMode: true,
  maxContextTokens: 1_000_000,
  supportedModels: ["mock-v1"],
};

const HEADER_FIELD_HINTS: ReadonlyArray<readonly [RegExp, CrmOutputField]> = [
  [/name/i, "name"],
  [/compan/i, "company"],
  [/city/i, "city"],
  [/\bstate\b/i, "state"],
  [/countr/i, "country"],
  [/status/i, "crm_status"],
  [/note|remark/i, "crm_note"],
  [/owner/i, "lead_owner"],
  [/possession/i, "possession_time"],
  [/descri/i, "description"],
];

/**
 * Deterministic stand-in for a real LLM: never calls a network API, so tests
 * and dev environments without an API key still get realistic, non-trivial
 * extraction results. Reuses the CSV Ingestion Engine's own pattern
 * detectors (email/phone/date) rather than duplicating that logic — the
 * mock is a small rule-based "fake AI," not a copy of the real one.
 */
export class MockProvider implements LLMProvider {
  readonly id = "mock";
  readonly capabilities = CAPABILITIES;

  async complete(request: AIRequest): Promise<AIResponse> {
    const startedAt = Date.now();
    const rows = extractBatchRows(request);
    const text = JSON.stringify({ records: rows.map(synthesizeRecord) });
    const promptText = request.messages.map((message) => message.content).join("\n");

    return {
      text,
      model: request.model,
      usage: {
        promptTokens: estimateTokenCount(promptText),
        completionTokens: estimateTokenCount(text),
        totalTokens: estimateTokenCount(promptText) + estimateTokenCount(text),
      },
      finishReason: "stop",
      latencyMs: Date.now() - startedAt,
    };
  }
}

function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

function extractBatchRows(request: AIRequest): readonly MockBatchRow[] {
  const combined = request.messages.map((message) => message.content).join("\n");
  const markerIndex = combined.indexOf("# Current Batch");
  const searchFrom = markerIndex >= 0 ? combined.slice(markerIndex) : combined;

  const start = searchFrom.indexOf("{");
  const end = searchFrom.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(searchFrom.slice(start, end + 1));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      Array.isArray((parsed as { rows?: unknown }).rows)
    ) {
      return (parsed as { rows: MockBatchRow[] }).rows;
    }
  } catch {
    // A batch the mock can't parse just produces an empty extraction — the
    // orchestrator's own response parser is what's actually under test
    // elsewhere; this mock only needs to be realistic, not bulletproof.
  }
  return [];
}

function synthesizeRecord(row: MockBatchRow): {
  row: number;
  fields: Record<CrmOutputField, { value: string | null; sourceHeader: string | null }>;
} {
  const assigned = new Map<CrmOutputField, { value: string; sourceHeader: string }>();

  for (const [header, rawValue] of Object.entries(row.cells)) {
    if (rawValue === null || rawValue.trim() === "") {
      continue;
    }
    const targetField = guessTargetField(header, rawValue);
    if (targetField && !assigned.has(targetField)) {
      assigned.set(targetField, { value: rawValue, sourceHeader: header });
    }
  }

  const fields = Object.fromEntries(
    CRM_OUTPUT_FIELDS.map((field) => {
      const match = assigned.get(field);
      return [field, { value: match?.value ?? null, sourceHeader: match?.sourceHeader ?? null }];
    }),
  ) as Record<CrmOutputField, { value: string | null; sourceHeader: string | null }>;

  return { row: row.row, fields };
}

function guessTargetField(header: string, value: string): CrmOutputField | null {
  if (looksLikeEmail(value)) {
    return "email";
  }
  if (looksLikeDate(value)) {
    return "created_at";
  }
  if (looksLikePhone(value)) {
    return "mobile_without_country_code";
  }
  for (const [pattern, field] of HEADER_FIELD_HINTS) {
    if (pattern.test(header)) {
      return field;
    }
  }
  return null;
}
