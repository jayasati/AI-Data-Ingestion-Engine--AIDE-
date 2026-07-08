import { describe, expect, it } from "vitest";
import { DEFAULT_PIPELINE_CONFIGURATION, PipelineContext } from "@/pipeline/context";
import type { ParsedDataset, ParsedRow } from "@/pipeline/domain/parsing";
import { NormalizationStage } from "@/pipeline/stages/normalization/normalization-stage";

function row(rowNumber: number, cells: readonly string[]): ParsedRow {
  return { rowNumber, rawCells: cells, cells, status: "ok", warnings: [], context: {} };
}

function toDataset(headers: readonly string[], rows: readonly ParsedRow[]): ParsedDataset {
  return {
    headers,
    rows,
    delimiter: ",",
    encoding: "UTF-8",
    rowCount: rows.length,
    columnCount: headers.length,
    headerDuplicateFlags: headers.map(() => false),
  };
}

function freshContext(): PipelineContext {
  return PipelineContext.create("test-import", DEFAULT_PIPELINE_CONFIGURATION);
}

describe("NormalizationStage", () => {
  const stage = new NormalizationStage();

  it("implements the PipelineStage contract and reports 'normalization' as its name", () => {
    expect(stage.name).toBe("normalization");
  });

  it("reports outcome 'success' when no field carries a warning or failure", async () => {
    const dataset = toDataset(["Name", "Email"], [row(1, ["John Doe", "john@example.com"])]);
    const { result } = await stage.execute(dataset, freshContext());
    expect(result.outcome).toBe("success");
  });

  it("reports outcome 'warning' when at least one field carries a warning", async () => {
    const dataset = toDataset(["Date"], [row(1, ["05/06/2026"])]); // ambiguous
    const { result } = await stage.execute(dataset, freshContext());
    expect(result.outcome).toBe("warning");
  });

  it("does not mutate the input context; returns a new context with merged statistics", async () => {
    const context = freshContext();
    const dataset = toDataset(["Name"], [row(1, ["John"])]);
    const { context: returnedContext } = await stage.execute(dataset, context);
    expect(returnedContext).not.toBe(context);
    expect(returnedContext.statistics.rowsNormalized).toBe(1);
    expect(returnedContext.statistics.fieldsNormalized).toBe(1);
  });

  it("hand-verifies every NormalizationReport count against a fixture with known outcomes", async () => {
    // Row 1: valid email, valid international phone, unambiguous date, clean number, "yes" boolean, plain text.
    // Row 2: invalid email syntax, phone with no country, ambiguous date, blank cells (null).
    const headers = ["Email", "Phone", "Date", "Deal", "Active", "Notes"];
    const rows = [
      row(1, ["john@example.com", "+91 98765 43210", "2026-01-15", "890", "yes", "hello"]),
      // "bad,valid@example.com": canApply is gated by looksLikeEmail on EACH
      // split part (the second part matches), but `primary` is always the
      // FIRST part -- "bad" -- which does NOT itself look like an email, so
      // this is how EmailRule actually produces isValid:false in practice; a
      // single malformed value with no valid sibling never reaches EmailRule
      // at all (canApply would be false), it falls through to plain text.
      row(2, ["bad,valid@example.com", "555-123-4567", "05/06/2026", "N/A", "N/A", "N/A"]),
    ];
    const dataset = toDataset(headers, rows);

    const { result } = await stage.execute(dataset, freshContext());
    expect(result.outcome).toBe("warning");
    if (result.outcome !== "warning") throw new Error("unreachable");

    const { report } = result.output;
    expect(report.totalFields).toBe(12);
    expect(report.emailsNormalized).toBe(1); // row1 valid email
    expect(report.invalidEmails).toBe(1); // row2 "bad,valid@example.com" -> primary "bad" is invalid
    expect(report.phonesNormalized).toBe(1); // row1 +91 phone -> e164
    expect(report.invalidPhones).toBe(1); // row2 555-123-4567 -> no country
    expect(report.datesParsed).toBe(1); // row1 ISO date
    expect(report.failedDateParses).toBe(1); // row2 ambiguous date
    expect(report.numbersNormalized).toBe(1); // row1 "890"
    expect(report.booleansNormalized).toBe(1); // row1 "yes"
    expect(report.nullValuesDetected).toBe(3); // row2 Deal/Active/Notes are all "N/A"
    expect(report.fieldsWithWarnings).toBe(3); // row2 email, phone, date
    expect(report.fieldsFailed).toBe(0);
  });

  it("rolls up per-row warnings and hasErrors on each NormalizedRecord", async () => {
    const dataset = toDataset(
      ["Phone", "Date"],
      [row(1, ["555-123-4567", "05/06/2026"])], // both carry warnings
    );
    const { result } = await stage.execute(dataset, freshContext());
    if (result.outcome !== "warning") throw new Error("unreachable");

    const record = result.output.records[0];
    expect(record.hasErrors).toBe(false); // warnings, not failures
    expect(record.warnings).toHaveLength(2);
    expect(record.warnings.map((w) => w.code).sort()).toEqual(
      ["AMBIGUOUS_DATE", "PHONE_COUNTRY_UNKNOWN"].sort(),
    );
  });

  it("emits stage-level aggregate warnings only for the categories that actually occurred", async () => {
    // See the fixture comment above: a lone malformed email never reaches
    // EmailRule (canApply is false), so a multi-part value with an invalid
    // primary and a valid sibling is required to actually trigger the
    // INVALID_EMAIL_SYNTAX path in the real routed pipeline.
    const dataset = toDataset(["Email"], [row(1, ["bad,valid@example.com"])]);
    const { result } = await stage.execute(dataset, freshContext());
    if (result.outcome !== "warning") throw new Error("unreachable");

    const codes = result.info.warnings.map((w) => w.code);
    expect(codes).toContain("INVALID_EMAILS");
    expect(codes).not.toContain("PHONES_WITHOUT_COUNTRY");
    expect(codes).not.toContain("UNRESOLVED_DATES");
    expect(codes).not.toContain("FIELDS_FAILED");
  });

  it("preserves the original value and never stops the pipeline when normalization is imperfect", async () => {
    const dataset = toDataset(["Date"], [row(1, ["05/06/2026"])]);
    const { result } = await stage.execute(dataset, freshContext());
    if (result.outcome !== "warning") throw new Error("unreachable");

    const field = result.output.records[0].fields[0];
    expect(field.originalValue).toBe("05/06/2026");
    expect(field.normalizedValue).toBe("05/06/2026");
    expect(field.status).toBe("warning");
  });

  it("carries the header through to each NormalizedField", async () => {
    const dataset = toDataset(["Customer Name"], [row(1, ["John"])]);
    const { result } = await stage.execute(dataset, freshContext());
    if (result.outcome !== "success") throw new Error("unreachable");
    expect(result.output.records[0].fields[0].header).toBe("Customer Name");
  });

  it("processes a large synthetic dataset without crashing and with a correct record count", async () => {
    const rowCount = 2000;
    const headers = ["Name", "Email", "Phone", "Date", "Deal"];
    const rows = Array.from({ length: rowCount }, (_, index) =>
      row(index + 1, [
        `Person ${index}`,
        `person${index}@example.com`,
        `+1 202 555 ${String(index).padStart(4, "0")}`,
        "2026-01-15",
        String(index),
      ]),
    );
    const dataset = toDataset(headers, rows);

    const { result } = await stage.execute(dataset, freshContext());
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") throw new Error("unreachable");
    expect(result.output.recordCount).toBe(rowCount);
    expect(result.output.report.totalFields).toBe(rowCount * headers.length);
  });
});
