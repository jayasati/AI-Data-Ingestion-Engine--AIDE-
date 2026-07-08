import type { Request, Response } from "express";
import { ValidationError } from "@/core/errors";
import { buildSuccess, requestMetadata } from "@/core/http/api-response";
import { decodeUploadBuffer } from "@/modules/preview/encoding-detector";
import { toAIExtractResponse } from "@/modules/ai/ai-extract-response-mapper";
import type { IAIExtractService } from "@/modules/ai/ai-extract.service";

export class AIExtractController {
  constructor(private readonly aiExtractService: IAIExtractService) {}

  extract = async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new ValidationError(
        'No file was uploaded. Send it as multipart/form-data under the "file" field.',
      );
    }

    const decoded = decodeUploadBuffer(req.file.buffer);
    const result = await this.aiExtractService.extract({
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      declaredSizeBytes: req.file.size,
      content: decoded.content,
      detectedEncoding: decoded.detectedEncoding,
    });

    res
      .status(200)
      .json(buildSuccess(req.requestId, toAIExtractResponse(result), requestMetadata(req)));
  };
}
