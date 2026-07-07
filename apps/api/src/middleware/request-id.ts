import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Assigns (or propagates) the correlation id. Runs first so every log line and
 * response envelope for the request carries the same id.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = req.header("x-request-id") ?? randomUUID();
  req.requestId = id;
  req.startedAt = Date.now();
  res.setHeader("x-request-id", id);
  next();
}
