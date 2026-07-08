import { loadConfig, SERVICE_NAME, type AppConfig } from "@/config";
import { loadAIConfig } from "@/config/ai-config";
import { createLogger, type Logger } from "@/core/logger";
import { loadExecutionConfig } from "@/execution";
import { AIExtractController } from "@/modules/ai/ai-extract.controller";
import { AIExtractService } from "@/modules/ai/ai-extract.service";
import { HealthController } from "@/modules/health/health.controller";
import { HealthService } from "@/modules/health/health.service";
import { ImportController } from "@/modules/import/import.controller";
import { ImportService } from "@/modules/import/import.service";
import { PreviewController } from "@/modules/preview/preview.controller";
import { PreviewService } from "@/modules/preview/preview.service";
import { UploadController } from "@/modules/upload/upload.controller";
import { UploadService } from "@/modules/upload/upload.service";

export interface Container {
  config: AppConfig;
  logger: Logger;
  healthController: HealthController;
  uploadController: UploadController;
  previewController: PreviewController;
  importController: ImportController;
  aiExtractController: AIExtractController;
}

/**
 * Composition root — the only place where concrete implementations are chosen.
 * Everything else depends on interfaces via constructor injection, so swapping
 * a provider (or adopting a DI framework later) touches this file alone.
 */
export function createContainer(): Container {
  const config = loadConfig();
  const logger = createLogger(config.logLevel, { service: SERVICE_NAME });

  const healthController = new HealthController(new HealthService(config));
  const uploadController = new UploadController(new UploadService());
  const previewController = new PreviewController(new PreviewService());
  const importController = new ImportController(
    new ImportService(loadAIConfig(), loadExecutionConfig(), logger),
  );
  const aiExtractController = new AIExtractController(new AIExtractService(loadAIConfig()));

  return {
    config,
    logger,
    healthController,
    uploadController,
    previewController,
    importController,
    aiExtractController,
  };
}
