import { Router } from "express";
import type { HealthController } from "@/modules/health/health.controller";

export function createHealthRouter(controller: HealthController): Router {
  const router = Router();
  router.get("/", controller.getHealth);
  return router;
}
