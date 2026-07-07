import type { NextFunction, Request, Response } from "express";
import { NotFoundError } from "@/core/errors";

/** Mounted after all routers; funnels unmatched routes into the error pipeline. */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route ${req.method} ${req.path} does not exist.`));
}
