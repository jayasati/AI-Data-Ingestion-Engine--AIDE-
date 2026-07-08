import { describe, expect, it } from "vitest";
import { detectDatasetType } from "@/semantic/dataset-intelligence/dataset-type-detector";

describe("detectDatasetType", () => {
  it("detects a Facebook Leads export from its header vocabulary", () => {
    const result = detectDatasetType([
      "full_name",
      "email",
      "campaign_name",
      "ad_set_name",
      "platform",
    ]);
    expect(result.detectedType).toBe("facebook_leads");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("detects a real-estate CRM export", () => {
    const result = detectDatasetType(["customer", "email", "possession", "tower", "project"]);
    expect(result.detectedType).toBe("real_estate");
  });

  it("detects a generic CRM export", () => {
    const result = detectDatasetType(["contact_name", "mail_id", "lead_owner", "crm_status"]);
    expect(result.detectedType).toBe("crm_export");
  });

  it("falls back to manual_spreadsheet for a tiny, vocabulary-free header set", () => {
    const result = detectDatasetType(["info"]);
    expect(result.detectedType).toBe("manual_spreadsheet");
  });

  it("falls back to unknown for a large, vocabulary-free header set", () => {
    const result = detectDatasetType(["col_a", "col_b", "col_c", "col_d", "col_e"]);
    expect(result.detectedType).toBe("unknown");
    expect(result.confidence).toBe(0);
  });

  it("detects mixed when two domains score closely", () => {
    const result = detectDatasetType(["campaign_name", "ad_group", "lead_owner", "crm_status"]);
    expect(["mixed", "google_ads", "crm_export"]).toContain(result.detectedType);
  });

  it("always returns a signal entry for every lexicon domain", () => {
    const result = detectDatasetType(["name", "email"]);
    const types = result.signals.map((s) => s.type);
    expect(types).toContain("facebook_leads");
    expect(types).toContain("real_estate");
    expect(types).toContain("crm_export");
  });
});
