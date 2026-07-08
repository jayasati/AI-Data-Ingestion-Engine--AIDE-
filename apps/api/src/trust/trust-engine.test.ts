import { describe, expect, it } from "vitest";
import { CRM_OUTPUT_FIELDS, type CrmOutputField } from "@/ai/schema/crm-output-schema";
import { runTrustLayer } from "@/trust/trust-engine";
import type {
  ExtractedField,
  ExtractedRecord,
  SemanticExtractionResult,
} from "@/pipeline/domain/extraction";

function record(
  rowNumber: number,
  values: Partial<Record<CrmOutputField, string | null>>,
): ExtractedRecord {
  const fields: ExtractedField[] = CRM_OUTPUT_FIELDS.map((targetField) => {
    const value = values[targetField] ?? null;
    return { sourceHeader: targetField, targetField, value, confidence: value !== null ? 1 : 0 };
  });
  return { rowNumber, fields };
}

function extraction(...records: ExtractedRecord[]): SemanticExtractionResult {
  return { records };
}

describe("runTrustLayer", () => {
  it("approves a fully clean, well-formed record", () => {
    const result = runTrustLayer({
      extraction: extraction(
        record(1, {
          name: "John Doe",
          email: "john@example.com",
          mobile_without_country_code: "9833311111",
          created_at: "2026-01-15",
          crm_status: "GOOD_LEAD_FOLLOW_UP",
          data_source: "meridian_tower",
        }),
      ),
    });

    const [validated] = result.records;
    expect(validated.approvalStatus).toBe("approved");
    expect(validated.isValid).toBe(true);
    expect(validated.skipped).toBe(false);
    expect(validated.repairCount).toBe(0);
    expect(validated.qualityScore).toBeGreaterThan(0);
  });

  it("skips a record with neither email nor phone, before any other check matters", () => {
    const result = runTrustLayer({
      extraction: extraction(record(1, { name: "John Doe", crm_status: "not a real status" })),
    });

    const [validated] = result.records;
    expect(validated.skipped).toBe(true);
    expect(validated.approvalStatus).toBe("skipped");
    expect(validated.skipReason).toBeTruthy();
  });

  it("repairs a near-miss crm_status and still approves an otherwise fully-populated record", () => {
    const result = runTrustLayer({
      extraction: extraction(
        record(1, {
          name: "John Doe",
          email: "john@example.com",
          mobile_without_country_code: "9833311111",
          company: "Acme",
          city: "Bengaluru",
          state: "Karnataka",
          country: "India",
          created_at: "2026-01-15",
          crm_status: "good_lead_follow_up",
          data_source: "meridian_tower",
        }),
      ),
    });

    const [validated] = result.records;
    expect(validated.repairCount).toBe(1);
    expect(validated.repairsApplied[0].kind).toBe("enum_closest_match");
    const crmStatusField = validated.fields.find((f) => f.field === "crm_status")!;
    expect(crmStatusField.value).toBe("GOOD_LEAD_FOLLOW_UP");
    expect(crmStatusField.repairStatus).toBe("repaired");
    expect(validated.approvalStatus).toBe("approved");
  });

  it("rejects a record whose crm_status is invalid and unrepairable", () => {
    const result = runTrustLayer({
      extraction: extraction(
        record(1, { email: "john@example.com", crm_status: "totally unrelated garbage value" }),
      ),
    });

    const [validated] = result.records;
    expect(validated.approvalStatus).toBe("rejected");
    expect(validated.isValid).toBe(false);
    expect(validated.classifiedIssues.some((i) => i.category === "business")).toBe(true);
  });

  it("normalizes a non-ISO created_at via the repair engine", () => {
    const result = runTrustLayer({
      extraction: extraction(record(1, { email: "john@example.com", created_at: "15-Jan-2026" })),
    });

    const [validated] = result.records;
    const createdAtField = validated.fields.find((f) => f.field === "created_at")!;
    expect(createdAtField.value).toBe("2026-01-15");
    expect(createdAtField.repairStatus).toBe("repaired");
  });

  it("approves a thin-but-clean record (only name/email/phone/status, a realistic minimum CSV)", () => {
    const result = runTrustLayer({
      extraction: extraction(
        record(1, {
          name: "John Doe",
          email: "john@example.com",
          mobile_without_country_code: "9833311111",
          crm_status: "GOOD_LEAD_FOLLOW_UP",
        }),
      ),
    });

    expect(result.records[0].approvalStatus).toBe("approved");
  });

  it("produces a lower quality score for a sparse record than a fully populated one", () => {
    const sparse = runTrustLayer({
      extraction: extraction(record(1, { email: "john@example.com" })),
    }).records[0];
    const full = runTrustLayer({
      extraction: extraction(
        record(1, {
          name: "John Doe",
          email: "john@example.com",
          mobile_without_country_code: "9833311111",
          company: "Acme",
          city: "Bengaluru",
          state: "Karnataka",
          country: "India",
          created_at: "2026-01-15",
          crm_status: "GOOD_LEAD_FOLLOW_UP",
          data_source: "meridian_tower",
        }),
      ),
    }).records[0];

    expect(full.qualityScore).toBeGreaterThan(sparse.qualityScore);
  });

  it("carries every field, including null ones, in the per-field report", () => {
    const result = runTrustLayer({
      extraction: extraction(record(1, { email: "john@example.com" })),
    });
    expect(result.records[0].fields).toHaveLength(CRM_OUTPUT_FIELDS.length);
  });

  it("rolls every record up into an accurate dataset summary", () => {
    const result = runTrustLayer({
      extraction: extraction(
        record(1, {
          email: "john@example.com",
          crm_status: "GOOD_LEAD_FOLLOW_UP",
          data_source: "meridian_tower",
        }),
        record(2, {}), // no contact info -> skipped
        record(3, { email: "jane@example.com", crm_status: "totally invalid" }), // rejected
      ),
    });

    expect(result.summary.totalRecords).toBe(3);
    expect(result.summary.skippedCount).toBe(1);
    expect(result.summary.rejectedCount).toBe(1);
    expect(result.summary.approvedCount + result.summary.needsReviewCount).toBe(1);
  });

  it("never throws for a record that fails every check", () => {
    expect(() =>
      runTrustLayer({
        extraction: extraction(
          record(1, { crm_status: "garbage", data_source: "garbage", created_at: "garbage" }),
        ),
      }),
    ).not.toThrow();
  });
});
