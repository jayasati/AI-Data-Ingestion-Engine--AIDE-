import { Router } from "express";
import multer from "multer";
import { DEFAULT_PIPELINE_CONFIGURATION } from "@/pipeline";
import type { ImportController } from "@/modules/import/import.controller";

/** Same in-memory, no-persistence upload policy as the preview and AI-extract modules. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DEFAULT_PIPELINE_CONFIGURATION.maxFileSizeBytes },
});

export function createImportRouter(controller: ImportController): Router {
  const router = Router();
  router.post("/", upload.single("file"), controller.startImport);
  router.get("/:id", controller.getImportResult);
  return router;
}
