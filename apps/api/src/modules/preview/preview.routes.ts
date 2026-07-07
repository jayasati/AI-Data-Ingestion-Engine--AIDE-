import { Router } from "express";
import type { PreviewController } from "@/modules/preview/preview.controller";

export function createPreviewRouter(controller: PreviewController): Router {
  const router = Router();
  router.post("/", controller.previewUpload);
  return router;
}
