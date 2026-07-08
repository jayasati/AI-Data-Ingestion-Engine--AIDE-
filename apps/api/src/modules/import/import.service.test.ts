import { describe, expect, it } from "vitest";
import { ImportStatus } from "@aide/shared-types";
import { ImportService } from "@/modules/import/import.service";
import { NotFoundError } from "@/core/errors";
import type { AIConfig } from "@/config/ai-config";
import { DEFAULT_EXECUTION_CONFIG } from "@/execution";

const MOCK_AI_CONFIG: AIConfig = {
  defaultProvider: "mock",
  model: "mock-v1",
  temperature: 0.2,
  maxTokens: 4096,
  timeoutMs: 45_000,
  retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
  promptVersion: "v1.0",
  outputSchemaVersion: "v1.0",
};

const CSV_CONTENT = "Name,Email,Phone\nJohn Doe,john@example.com,9833311111\n";

function upload() {
  return {
    fileName: "leads.csv",
    mimeType: "text/csv",
    declaredSizeBytes: CSV_CONTENT.length,
    content: CSV_CONTENT,
    detectedEncoding: "utf-8",
  };
}

async function waitForTerminalStatus(
  service: ImportService,
  importId: string,
  timeoutMs = 5000,
): Promise<ReturnType<ImportService["getImportResult"]>> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const summary = service.getImportResult(importId);
    if (summary.status !== ImportStatus.Processing && summary.status !== ImportStatus.Pending) {
      return summary;
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Import "${importId}" did not reach a terminal status within ${timeoutMs}ms.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("ImportService", () => {
  it("startImport accepts a valid CSV and returns Pending with a real importId", async () => {
    const service = new ImportService(MOCK_AI_CONFIG, DEFAULT_EXECUTION_CONFIG);
    const accepted = await service.startImport(upload());

    expect(accepted.status).toBe(ImportStatus.Pending);
    expect(accepted.importId).toBeTruthy();
  });

  it("getImportResult throws NotFoundError for an unknown importId", () => {
    const service = new ImportService(MOCK_AI_CONFIG, DEFAULT_EXECUTION_CONFIG);
    expect(() => service.getImportResult("does-not-exist")).toThrow(NotFoundError);
  });

  it("getImportResult reports Processing immediately after startImport, before the background run finishes", async () => {
    const service = new ImportService(MOCK_AI_CONFIG, DEFAULT_EXECUTION_CONFIG);
    const accepted = await service.startImport(upload());
    const summary = service.getImportResult(accepted.importId);
    expect([ImportStatus.Pending, ImportStatus.Processing]).toContain(summary.status);
  });

  it("runs a real end-to-end import (Upload -> CSV Parsing -> Execution Engine -> Trust Layer) and reaches Completed", async () => {
    const service = new ImportService(MOCK_AI_CONFIG, DEFAULT_EXECUTION_CONFIG);
    const accepted = await service.startImport(upload());

    const summary = await waitForTerminalStatus(service, accepted.importId);

    expect(summary.status).toBe(ImportStatus.Completed);
    expect(summary.totalRows).toBe(1);
    expect(summary.batches.length).toBeGreaterThan(0);
    expect(summary.progress).toBeNull();
  });

  it("rejects a file with no rows via the same Upload/CSV-Parsing failure path as before", async () => {
    const service = new ImportService(MOCK_AI_CONFIG, DEFAULT_EXECUTION_CONFIG);
    await expect(
      service.startImport({
        fileName: "empty.csv",
        mimeType: "text/csv",
        declaredSizeBytes: 0,
        content: "",
        detectedEncoding: "utf-8",
      }),
    ).rejects.toThrow();
  });
});
