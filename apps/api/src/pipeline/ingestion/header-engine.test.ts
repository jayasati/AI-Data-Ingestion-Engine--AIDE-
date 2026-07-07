import { describe, expect, it } from "vitest";
import { buildHeaderProfiles, normalizeHeaderName } from "@/pipeline/ingestion/header-engine";

describe("normalizeHeaderName", () => {
  it("converts a space-separated header to snake_case", () => {
    expect(normalizeHeaderName("Customer Name")).toBe("customer_name");
  });

  it("converts another space-separated header to snake_case", () => {
    expect(normalizeHeaderName("Phone Number")).toBe("phone_number");
  });

  it("lowercases and strips punctuation runs to a single underscore", () => {
    expect(normalizeHeaderName("E-Mail Address!!")).toBe("e_mail_address");
  });

  it("preserves accented letters rather than stripping them", () => {
    expect(normalizeHeaderName("Código Postal")).toBe("código_postal");
  });

  it("collapses repeated separators into one underscore", () => {
    expect(normalizeHeaderName("Deal   Size___USD")).toBe("deal_size_usd");
  });

  it("falls back to 'column' for an all-punctuation header", () => {
    expect(normalizeHeaderName("!!!")).toBe("column");
  });

  it("falls back to 'column' for an empty header", () => {
    expect(normalizeHeaderName("")).toBe("column");
  });

  it("trims leading and trailing separators", () => {
    expect(normalizeHeaderName("  Mail ID  ")).toBe("mail_id");
  });
});

describe("buildHeaderProfiles", () => {
  it("marks every column as not duplicate when all headers are distinct", () => {
    const profiles = buildHeaderProfiles(["Name", "Email", "Phone"]);
    expect(profiles.map((p) => p.isDuplicate)).toEqual([false, false, false]);
  });

  it("flags near-duplicates that differ only in spelling via normalized-form collision", () => {
    const profiles = buildHeaderProfiles(["Email Address", "email-address", "Notes"]);
    expect(profiles[0].normalizedHeader).toBe("email_address");
    expect(profiles[1].normalizedHeader).toBe("email_address");
    expect(profiles[0].isDuplicate).toBe(true);
    expect(profiles[1].isDuplicate).toBe(true);
    expect(profiles[2].isDuplicate).toBe(false);
  });

  it("flags exact raw duplicates via the rawDuplicateFlags signal even after they normalize differently", () => {
    // Simulates Volume 2's disambiguator having already renamed "Email"/"Email (2)".
    const headers = ["Email", "Email (2)", "Notes"];
    const rawDuplicateFlags = [true, true, false];
    const profiles = buildHeaderProfiles(headers, rawDuplicateFlags);
    expect(profiles[0].normalizedHeader).toBe("email");
    expect(profiles[1].normalizedHeader).toBe("email_2");
    expect(profiles[0].isDuplicate).toBe(true);
    expect(profiles[1].isDuplicate).toBe(true);
    expect(profiles[2].isDuplicate).toBe(false);
  });

  it("does not flag duplicates when rawDuplicateFlags is omitted and headers normalize distinctly", () => {
    const profiles = buildHeaderProfiles(["Email", "Email (2)", "Notes"]);
    expect(profiles.map((p) => p.isDuplicate)).toEqual([false, false, false]);
  });

  it("assigns sequential column indices", () => {
    const profiles = buildHeaderProfiles(["A", "B", "C"]);
    expect(profiles.map((p) => p.columnIndex)).toEqual([0, 1, 2]);
  });

  it("preserves the original header text unmodified", () => {
    const profiles = buildHeaderProfiles([" Mail ID "]);
    expect(profiles[0].originalHeader).toBe(" Mail ID ");
  });
});
