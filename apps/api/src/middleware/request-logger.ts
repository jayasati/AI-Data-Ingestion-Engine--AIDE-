import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { Logger } from "@/core/logger";

export function requestLogger(logger: Logger): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on("finish", () => {
      logger.info("http.request.completed", {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - req.startedAt,
      });
    });
    next();
  };
}
