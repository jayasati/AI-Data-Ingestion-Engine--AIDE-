import cors from "cors";
import express from "express";
import type { Container } from "@/core/container";
import { errorHandler } from "@/middleware/error-handler";
import { notFound } from "@/middleware/not-found";
import { requestId } from "@/middleware/request-id";
import { requestLogger } from "@/middleware/request-logger";
import { createHealthRouter } from "@/modules/health/health.routes";
import { createImportRouter } from "@/modules/import/import.routes";
import { createPreviewRouter } from "@/modules/preview/preview.routes";
import { createUploadRouter } from "@/modules/upload/upload.routes";

/**
 * Pure app factory: no listening, no environment reads — everything arrives via
 * the container, which keeps the app constructible in tests without a socket.
 */
export function createApp(container: Container): express.Express {
  const { config, logger } = container;
  const app = express();

  app.disable("x-powered-by");

  app.use(requestId);
  app.use(requestLogger(logger));
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: config.jsonBodyLimit }));

  app.use("/health", createHealthRouter(container.healthController));
  app.use("/upload", createUploadRouter(container.uploadController));
  app.use("/preview", createPreviewRouter(container.previewController));
  app.use("/import", createImportRouter(container.importController));

  app.use(notFound);
  app.use(errorHandler(logger));

  return app;
}
