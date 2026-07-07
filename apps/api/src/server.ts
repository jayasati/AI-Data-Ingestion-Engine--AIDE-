import { createApp } from "@/app";
import { createContainer } from "@/core/container";

function bootstrap(): void {
  const container = createContainer();
  const { config, logger } = container;
  const app = createApp(container);

  const server = app.listen(config.port, () => {
    logger.info("server.started", { port: config.port, environment: config.nodeEnv });
  });

  const shutdown = (signal: string): void => {
    logger.info("server.shutdown.initiated", { signal });
    server.close(() => {
      logger.info("server.shutdown.completed");
      process.exit(0);
    });
    // In-flight requests get a grace period; then the process force-exits so a
    // hung connection can never block a deploy.
    setTimeout(() => process.exit(1), config.shutdownGraceMs).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap();
