import { randomUUID } from "node:crypto";
import type { UploadRequest, UploadResponse } from "@aide/shared-types";

export interface IUploadService {
  registerUpload(request: UploadRequest): UploadResponse;
}

/**
 * Placeholder: acknowledges upload metadata only. Multipart streaming, file
 * validation, and temp storage land here in the CSV-processing phase.
 */
export class UploadService implements IUploadService {
  registerUpload(request: UploadRequest): UploadResponse {
    return {
      uploadId: randomUUID(),
      fileName: request.fileName,
      receivedAt: new Date().toISOString(),
      status: "accepted",
    };
  }
}
