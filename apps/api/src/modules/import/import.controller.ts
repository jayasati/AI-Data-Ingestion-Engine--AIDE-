import type { Request, Response } from "express";
import { ValidationError } from "@/core/errors";
import { buildSuccess, requestMetadata } from "@/core/http/api-response";
import type { IImportService } from "@/modules/import/import.service";

export class ImportController {
  constructor(private readonly importService: IImportService) {}

  startImport = (req: Request, res: Response): void => {
    res
      .status(202)
      .json(buildSuccess(req.requestId, this.importService.startImport(), requestMetadata(req)));
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
