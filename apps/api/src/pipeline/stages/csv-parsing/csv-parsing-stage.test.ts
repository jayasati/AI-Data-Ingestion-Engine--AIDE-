import { describe, expect, it } from "vitest";
import { DEFAULT_PIPELINE_CONFIGURATION, PipelineContext } from "@/pipeline/context";
import type { UploadContext } from "@/pipeline/domain/upload";
import { CsvParsingStage } from "@/pipeline/stages/csv-parsing/csv-parsing-stage";

function toUploadContext(content: string): UploadContext {
  return {
    uploadedFile: {
      uploadId: "u1",
      fileName: "t.csv",
      mimeType: "text/csv",
      sizeBytes: Buffer.byteLength(content, "utf8"),
      content,
      receivedAt: new Date().toISOString(),
    },
  };
}

function freshContext(): PipelineContext {
  return PipelineContext.create("test-import", DEFAULT_PIPELINE_CONFIGURATION);
}

describe("CsvParsingStage", () => {
  const stage = new CsvParsingStage();

  it("fails fatally with EMPTY_DATASET for empty content", async () => {
    const { result } = await stage.execute(toUploadContext(""), freshContext());
    expect(result.outcome).toBe("fatal_failure");
    if (result.outcome !== "fatal_failure") throw new Error("unreachable");
    expect(result.info.errors[0].code).toBe("EMPTY_DATASET");
    expect(result.output).toBeNull();
  });

  it("fails fatally with HEADERLESS_FILE when every header cell is blank", async () => {
    const { result } = await stage.execute(toUploadContext(",,,\na,b,c,d"), freshContext());
    expect(result.outcome).toBe("fatal_failure");
    if (result.outcome !== "fatal_failure") throw new Error("unreachable");
    expect(result.info.errors[0].code).toBe("HEADERLESS_FILE");
  });

  it("parses a clean file as success with no warnings", async () => {
    const { result } = await stage.execute(
      toUploadContext("Name,Email\nJohn,john@x.com\nJane,jane@x.com"),
      freshContext(),
    );
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") throw new Error("unreachable");
    expect(result.output.rowCount).toBe(2);
    expect(result.output.columnCount).toBe(2);
    expect(result.output.headers).toEqual(["Name", "Email"]);
    expect(result.output.rows[0]).toMatchObject({
      rowNumber: 1,
      cells: ["John", "john@x.com"],
      status: "ok",
      warnings: [],
    });
    expect(result.info.warnings).toEqual([]);
  });

  it("handles duplicate headers, a blank row, and a ragged row together with correct metadata and per-row status", async () => {
    const content = [
      "Email,Email,Notes",
      "a@x.com,b@x.com,first",
      ",,",
      "c@x.com,d@x.com,second,extra",
    ].join("\n");

    const { result } = await stage.execute(toUploadContext(content), freshContext());
    expect(result.outcome).toBe("warning");
    if (result.outcome !== "warning") throw new Error("unreachable");

    expect(result.output.headers).toEqual(["Email", "Email (2)", "Notes"]);
    expect(result.output.headerDuplicateFlags).toEqual([true, true, false]);
    expect(result.output.rowCount).toBe(2); // blank row excluded
    expect(result.info.metadata.blankRowsSkipped).toBe(1);
    expect(result.info.metadata.duplicateHeadersRenamed).toBe(1);
    expect(result.info.metadata.raggedRowCount).toBe(1);

    const [firstRow, secondRow] = result.output.rows;
    expect(firstRow.status).toBe("ok");
    expect(firstRow.warnings).toEqual([]);

    expect(secondRow.status).toBe("recovered");
    expect(secondRow.rowNumber).toBe(2);
    expect(secondRow.rawCells).toEqual(["c@x.com", "d@x.com", "second", "extra"]);
    expect(secondRow.cells).toEqual(["c@x.com", "d@x.com", "second"]);
    expect(secondRow.warnings[0].code).toBe("ROW_TRUNCATED");

    const warningCodes = result.info.warnings.map((w) => w.code).sort();
    expect(warningCodes).toEqual(
      ["BLANK_ROWS_SKIPPED", "DUPLICATE_HEADERS_RENAMED", "RAGGED_ROWS_ADJUSTED"].sort(),
    );
  });

  it("pads a short row and reports ROW_PADDED", async () => {
    const content = "A,B,C\n1,2";
    const { result } = await stage.execute(toUploadContext(content), freshContext());
    expect(result.outcome).toBe("warning");
    if (result.outcome !== "warning") throw new Error("unreachable");
    const row = result.output.rows[0];
    expect(row.status).toBe("recovered");
    expect(row.rawCells).toEqual(["1", "2"]);
    expect(row.cells).toEqual(["1", "2", ""]);
    expect(row.warnings[0].code).toBe("ROW_PADDED");
  });

  it("parses a large synthetic CSV without crashing and reports the correct row count", async () => {
    const rowCount = 5000;
    const header = "Name,Email,Phone";
    const dataRows = Array.from(
      { length: rowCount },
      (_, index) => `Person ${index},person${index}@example.com,${1000000000 + index}`,
    );
    const content = [header, ...dataRows].join("\n");

    const { result } = await stage.execute(toUploadContext(content), freshContext());
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") throw new Error("unreachable");
    expect(result.output.rowCount).toBe(rowCount);
    expect(result.output.rows[rowCount - 1].cells[0]).toBe(`Person ${rowCount - 1}`);
  });

  it("reports the delimiter and encoding in both the dataset and stage metadata", async () => {
    const { result } = await stage.execute(toUploadContext("A;B\n1;2"), freshContext());
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") throw new Error("unreachable");
    expect(result.output.delimiter).toBe(";");
    expect(result.output.encoding).toBe("UTF-8");
    expect(result.info.metadata.delimiter).toBe(";");
  });

  it("does not mutate the input context on failure paths", async () => {
    const context = freshContext();
    const { context: returnedContext } = await stage.execute(toUploadContext(""), context);
    expect(returnedContext).toBe(context);
  });
});
