import type { Request, Response } from "express";
import { ValidationError } from "@/core/errors";
import { buildSuccess, requestMetadata } from "@/core/http/api-response";
import { decodeUploadBuffer } from "@/modules/preview/encoding-detector";
import type { IImportService } from "@/modules/import/import.service";

export class ImportController {
  constructor(private readonly importService: IImportService) {}

  startImport = async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new ValidationError(
        'No file was uploaded. Send it as multipart/form-data under the "file" field.',
      );
    }

    const decoded = decodeUploadBuffer(req.file.buffer);
    const accepted = await this.importService.startImport({
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      declaredSizeBytes: req.file.size,
      content: decoded.content,
      detectedEncoding: decoded.detectedEncoding,
    });

    res.status(202).json(buildSuccess(req.requestId, accepted, requestMetadata(req)));
  };

  getImportResult = (req: Request, res: Response): void => {
    const importId = req.params.id;
    if (typeof importId !== "string" || importId.trim() === "") {
      throw new ValidationError("Import id must be a non-empty string.");
    }
    res
      .status(200)
      .json(
        buildSuccess(
          req.requestId,
          this.importService.getImportResult(importId),
          requestMetadata(req),
        ),
      );
  };
}
