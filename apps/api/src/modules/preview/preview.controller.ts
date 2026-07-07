import type { Request, Response } from "express";
import { buildSuccess, requestMetadata } from "@/core/http/api-response";
import type { IPreviewService } from "@/modules/preview/preview.service";

export class PreviewController {
  constructor(private readonly previewService: IPreviewService) {}

  previewUpload = (req: Request, res: Response): void => {
    res
      .status(202)
      .json(buildSuccess(req.requestId, this.previewService.previewUpload(), requestMetadata(req)));
  };
}
