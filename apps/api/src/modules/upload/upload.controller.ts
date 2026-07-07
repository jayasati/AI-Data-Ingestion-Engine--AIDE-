import type { Request, Response } from "express";
import type { UploadRequest } from "@aide/shared-types";
import { ValidationError } from "@/core/errors";
import { buildSuccess, requestMetadata } from "@/core/http/api-response";
import type { IUploadService } from "@/modules/upload/upload.service";

export class UploadController {
  constructor(private readonly uploadService: IUploadService) {}

  registerUpload = (req: Request, res: Response): void => {
    const uploadRequest = parseUploadRequest(req.body);
    const result = this.uploadService.registerUpload(uploadRequest);
    res.status(201).json(buildSuccess(req.requestId, result, requestMetadata(req)));
  };
}

function parseUploadRequest(body: unknown): UploadRequest {
  const candidate = (body ?? {}) as Record<string, unknown>;
  const issues: string[] = [];

  if (typeof candidate.fileName !== "string" || candidate.fileName.trim() === "") {
    issues.push("fileName must be a non-empty string");
  }
  if (
    typeof candidate.fileSize !== "number" ||
    !Number.isFinite(candidate.fileSize) ||
    candidate.fileSize <= 0
  ) {
    issues.push("fileSize must be a positive number");
  }
  if (typeof candidate.mimeType !== "string" || candidate.mimeType.trim() === "") {
    issues.push("mimeType must be a non-empty string");
  }
  if (issues.length > 0) {
    throw new ValidationError("Invalid upload request.", { issues });
  }

  return {
    fileName: candidate.fileName as string,
    fileSize: candidate.fileSize as number,
    mimeType: candidate.mimeType as string,
  };
}
