import type { NormalizedRecord } from "@/pipeline/domain/normalization";
import { wrapUntrustedBatchPayload } from "@/prompt/security/injection-defense";

/**
 * MUST remain the last section of the compiled user message, and its JSON
 * payload's `{ "rows": [{ row, cells }] }` shape must not change:
 * `MockProvider.extractBatchRows` (ai/providers/mock-provider.ts) locates it
 * by the "# Current Batch" marker and the last `{...}` block in the message.
 * `wrapUntrustedBatchPayload`'s fence markers are brace-free specifically so
 * they can never interfere with that scan.
 */
export function buildCurrentBatchSection(records: readonly NormalizedRecord[]): string {
  const rows = records.map((record) => ({
    row: record.rowNumber,
    cells: Object.fromEntries(record.fields.map((field) => [field.header, field.normalizedValue])),
  }));

  const payload = JSON.stringify({ rows }, null, 2);
  return ["# Current Batch", wrapUntrustedBatchPayload(payload)].join("\n");
}
