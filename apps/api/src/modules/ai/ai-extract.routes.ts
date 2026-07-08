import { Router } from "express";
import multer from "multer";
import { DEFAULT_PIPELINE_CONFIGURATION } from "@/pipeline";
import type { AIExtractController } from "@/modules/ai/ai-extract.controller";

/** Same in-memory, no-persistence upload policy as the preview module. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DEFAULT_PIPELINE_CONFIGURATION.maxFileSizeBytes },
});

export function createAIExtractRouter(controller: AIExtractController): Router {
  const router = Router();
  router.post("/extract", upload.single("file"), controller.extract);
  return router;
}
