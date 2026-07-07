import { Router } from "express";
import multer from "multer";
import { DEFAULT_PIPELINE_CONFIGURATION } from "@/pipeline";
import type { PreviewController } from "@/modules/preview/preview.controller";

/**
 * Files never touch disk — memoryStorage hands CSV Parsing an in-memory
 * buffer, consistent with Volume 1's "no persistent storage in v1" decision.
 * The size limit is read from the pipeline's own config so there is one
 * source of truth for "how large a file the system accepts."
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DEFAULT_PIPELINE_CONFIGURATION.maxFileSizeBytes },
});

export function createPreviewRouter(controller: PreviewController): Router {
  const router = Router();
  router.post("/", upload.single("file"), controller.previewUpload);
  return router;
}
