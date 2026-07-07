import { describe, expect, it } from "vitest";
import { DEFAULT_PIPELINE_CONFIGURATION, PipelineContext } from "@/pipeline/context";
import { stageSucceeded } from "@/pipeline/contracts/stage-result";
import { CsvParsingStage } from "@/pipeline/stages/csv-parsing/csv-parsing-stage";
import { UploadStage } from "@/pipeline/stages/upload/upload-stage";
import { analyzeCsvIngestion } from "@/pipeline/ingestion/csv-ingestion-analyzer";

// A realistic CRM lead export: clean rows, one blank row, one ragged row, a
// missing phone value, and a duplicate header pair - mirrors what a real
// upload through the /preview endpoint looks like end to end.
const CRM_EXPORT_CSV = [
  "Name,Email,Email,Phone,Signup Date,Notes",
  "John Doe,john@example.com,backup@example.com,9876543210,2026-01-15,VIP customer",
  "Jane Roe,jane@example.com,,555-123-4567,01/20/2026,N/A",
  ",,,,,",
  "Amy Lee,amy@example.com,,,2026-03-05,Follow up next week,extra",
].join("\n");

async function runIngestion() {
  const context = PipelineContext.create("test-import", DEFAULT_PIPELINE_CONFIGURATION);
  const uploadStage = new UploadStage();
  const csvParsingStage = new CsvParsingStage();

  const uploadExecution = await uploadStage.execute(
    {
      fileName: "leads.csv",
      mimeType: "text/csv",
      declaredSizeBytes: Buffer.byteLength(CRM_EXPORT_CSV, "utf8"),
      content: CRM_EXPORT_CSV,
    },
    context,
  );
  if (!stageSucceeded(uploadExecution.result)) {
    throw new Error("upload stage unexpectedly failed in test setup");
  }

  const parseExecution = await csvParsingStage.execute(
    uploadExecution.result.output,
    uploadExecution.context,
  );
  if (!stageSucceeded(parseExecution.result)) {
    throw new Error("csv-parsing stage unexpectedly failed in test setup");
  }

  return analyzeCsvIngestion({
    dataset: parseExecution.result.output,
    uploadedFile: uploadExecution.result.output.uploadedFile,
    parserStageInfo: parseExecution.result.info,
  });
}

describe("analyzeCsvIngestion (end to end)", () => {
  it("produces an internally consistent DatasetPreview over a realistic CRM export", async () => {
    const preview = await runIngestion();

    // Structural consistency.
    expect(preview.previewRowCount).toBeLessThanOrEqual(preview.totalRowCount);
    expect(preview.headers.length).toBe(preview.datasetMetadata.totalColumns);
    expect(preview.columnProfiles.length).toBe(preview.datasetMetadata.totalColumns);
    expect(preview.rows.length).toBe(preview.previewRowCount);

    // The blank row was skipped and the ragged row was recovered.
    expect(preview.totalRowCount).toBe(3);
    expect(preview.datasetMetadata.blankRowCount).toBe(1);
    expect(preview.datasetMetadata.malformedRowCount).toBe(1);

    // Duplicate "Email" header was disambiguated but still flagged as a duplicate.
    expect(preview.headers.map((h) => h.originalHeader)).toEqual([
      "Name",
      "Email",
      "Email (2)",
      "Phone",
      "Signup Date",
      "Notes",
    ]);
    expect(preview.datasetMetadata.duplicateHeaderCount).toBe(2);

    // Every dataset intelligence hint must point at a real column.
    const allHints = [
      ...preview.datasetIntelligence.likelyEmailColumns,
      ...preview.datasetIntelligence.likelyPhoneColumns,
      ...preview.datasetIntelligence.likelyDateColumns,
      ...preview.datasetIntelligence.likelyNumericColumns,
      ...preview.datasetIntelligence.likelyTextColumns,
    ];
    for (const hint of allHints) {
      expect(hint.columnIndex).toBeGreaterThanOrEqual(0);
      expect(hint.columnIndex).toBeLessThan(preview.datasetMetadata.totalColumns);
    }

    // The primary "Email" column is a strong email match.
    const emailColumn = preview.columnProfiles.find((c) => c.originalHeader === "Email");
    expect(emailColumn?.dataTypeGuess).toBe("email");

    // Warnings are non-empty given the blank/ragged/duplicate-header fixture.
    expect(preview.warnings.length).toBeGreaterThan(0);
    const warningCodes = preview.warnings.map((w) => w.code);
    expect(warningCodes).toContain("BLANK_ROWS_SKIPPED");
    expect(warningCodes).toContain("RAGGED_ROWS_ADJUSTED");
  });

  it("respects a custom preview row limit", async () => {
    const context = PipelineContext.create("test-import", DEFAULT_PIPELINE_CONFIGURATION);
    const uploadStage = new UploadStage();
    const csvParsingStage = new CsvParsingStage();

    const uploadExecution = await uploadStage.execute(
      {
        fileName: "leads.csv",
        mimeType: "text/csv",
        declaredSizeBytes: Buffer.byteLength(CRM_EXPORT_CSV, "utf8"),
        content: CRM_EXPORT_CSV,
      },
      context,
    );
    if (!stageSucceeded(uploadExecution.result)) throw new Error("unreachable");

    const parseExecution = await csvParsingStage.execute(
      uploadExecution.result.output,
      uploadExecution.context,
    );
    if (!stageSucceeded(parseExecution.result)) throw new Error("unreachable");

    const preview = analyzeCsvIngestion({
      dataset: parseExecution.result.output,
      uploadedFile: uploadExecution.result.output.uploadedFile,
      parserStageInfo: parseExecution.result.info,
      previewOptions: { maxRows: 1 },
    });

    expect(preview.previewRowCount).toBe(1);
    expect(preview.totalRowCount).toBe(3);
    expect(preview.rows.length).toBe(1);
  });
});
