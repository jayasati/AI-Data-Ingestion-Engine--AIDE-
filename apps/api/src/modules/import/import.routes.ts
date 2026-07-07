import { Router } from "express";
import type { ImportController } from "@/modules/import/import.controller";

export function createImportRouter(controller: ImportController): Router {
  const router = Router();
  router.post("/", controller.startImport);
  router.get("/:id", controller.getImportResult);
  return router;
}
