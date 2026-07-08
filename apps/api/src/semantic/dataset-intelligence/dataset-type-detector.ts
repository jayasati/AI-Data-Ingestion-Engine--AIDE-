export const DATASET_TYPES = [
  "facebook_leads",
  "google_ads",
  "real_estate",
  "marketing",
  "sales",
  "crm_export",
  "manual_spreadsheet",
  "mixed",
  "unknown",
] as const;

export type DatasetType = (typeof DATASET_TYPES)[number];

type LexiconType = Exclude<DatasetType, "mixed" | "unknown" | "manual_spreadsheet">;

export interface DatasetTypeSignal {
  readonly type: LexiconType;
  readonly score: number;
  readonly matchedKeywords: readonly string[];
}

export interface DatasetTypeResult {
  readonly detectedType: DatasetType;
  readonly confidence: number;
  readonly signals: readonly DatasetTypeSignal[];
}

/**
 * Header-vocabulary lexicon per domain, matched against *normalized*
 * (snake_case) headers via substring containment — deliberately loose, since
 * a real export rarely repeats a vocabulary word verbatim (e.g. "ad set
 * name" vs "adset_name"). Small and hand-curated; intended to grow.
 */
const LEXICON: Readonly<Record<LexiconType, readonly string[]>> = {
  facebook_leads: [
    "ad_name",
    "ad_set",
    "adset",
    "campaign_name",
    "form_name",
    "platform",
    "lead_id",
    "full_name",
    "facebook",
  ],
  google_ads: ["campaign", "ad_group", "keyword", "gclid", "google_click_id", "submission_time"],
  real_estate: [
    "possession",
    "tower",
    "project",
    "flat",
    "builder",
    "unit",
    "bhk",
    "plot",
    "site_visit",
  ],
  marketing: [
    "utm_source",
    "utm_campaign",
    "utm_medium",
    "channel",
    "landing_page",
    "source_campaign",
  ],
  sales: ["deal", "pipeline", "stage", "quota", "opportunity", "revenue", "deal_stage"],
  crm_export: ["lead_owner", "crm_status", "lead_status", "last_activity", "account", "owner"],
};

/** 2+ distinct matched keywords already saturates a domain's confidence — no real CSV repeats a whole lexicon. */
const SIGNAL_SATURATION = 2;
const MIXED_MARGIN = 0.15;
const MANUAL_SPREADSHEET_MAX_COLUMNS = 3;

export function detectDatasetType(normalizedHeaders: readonly string[]): DatasetTypeResult {
  const signals: DatasetTypeSignal[] = (Object.keys(LEXICON) as LexiconType[])
    .map((type) => {
      const keywords = LEXICON[type];
      const matchedKeywords = keywords.filter((keyword) =>
        normalizedHeaders.some((header) => header.includes(keyword)),
      );
      return {
        type,
        score: Math.min(1, matchedKeywords.length / SIGNAL_SATURATION),
        matchedKeywords,
      };
    })
    .sort((a, b) => b.score - a.score);

  const [top, second] = signals;

  if (!top || top.score === 0) {
    const detectedType: DatasetType =
      normalizedHeaders.length <= MANUAL_SPREADSHEET_MAX_COLUMNS ? "manual_spreadsheet" : "unknown";
    return {
      detectedType,
      confidence: detectedType === "manual_spreadsheet" ? 0.4 : 0,
      signals,
    };
  }

  if (second && second.score > 0 && top.score - second.score < MIXED_MARGIN) {
    return { detectedType: "mixed", confidence: top.score * 0.7, signals };
  }

  return { detectedType: top.type, confidence: top.score, signals };
}
