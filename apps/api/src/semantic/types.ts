/**
 * The semantic engine's target vocabulary. Deliberately a superset-ish
 * projection of `CrmOutputField` (ai/schema/crm-output-schema.ts), not an
 * alias for it: "phone" has no single CRM field (it splits into
 * `country_code` + `mobile_without_country_code` downstream, a job for the
 * AI/normalization layer, not header-level semantic matching), and
 * `created_at` is usually system-derived rather than header-mapped but is
 * still worth recognizing when a dataset does carry an explicit date column.
 */
export const SEMANTIC_FIELD_IDS = [
  "name",
  "email",
  "phone",
  "company",
  "city",
  "state",
  "country",
  "lead_owner",
  "crm_status",
  "crm_note",
  "data_source",
  "possession_time",
  "description",
  "created_at",
] as const;

export type SemanticFieldId = (typeof SEMANTIC_FIELD_IDS)[number];

/**
 * Hybrid Mapping Engine's routing decision for one header:
 * "deterministic" — confidence is high enough to map without AI.
 * "ai_candidate" — medium confidence; AI receives ranked candidates as hints.
 * "ai_required" — low confidence; AI gets little more than the raw header.
 * "unknown" — no candidate field scored above the reporting floor at all.
 */
export type ConfidenceTier = "deterministic" | "ai_candidate" | "ai_required" | "unknown";
