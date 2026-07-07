import { Router } from "express";
import type { UploadController } from "@/modules/upload/upload.controller";

export function createUploadRouter(controller: UploadController): Router {
  const router = Router();
  router.post("/", controller.registerUpload);
  return router;
}
