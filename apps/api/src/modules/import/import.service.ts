import { randomUUID } from "node:crypto";
import { ImportStatus, type ResultSummary } from "@aide/shared-types";

export interface ImportAccepted {
  importId: string;
  status: ImportStatus;
}

export interface IImportService {
  startImport(): ImportAccepted;
  getImportResult(importId: string): ResultSummary;
}

/**
 * Placeholder: the real implementation dispatches to the pipeline execution
 * engine and reads results from the execution module. No persistence yet, so
 * every id resolves to a pending stub.
 */
export class ImportService implements IImportService {
  startImport(): ImportAccepted {
    return { importId: randomUUID(), status: ImportStatus.Pending };
  }

  getImportResult(importId: string): ResultSummary {
    return {
      importId,
      status: ImportStatus.Pending,
      totalRows: 0,
      importedCount: 0,
      skippedCount: 0,
      failedBatches: 0,
      durationMs: 0,
    };
  }
}
