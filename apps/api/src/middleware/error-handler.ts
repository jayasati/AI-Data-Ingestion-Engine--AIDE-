import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { ApplicationError, UnknownError } from "@/core/errors";
import { buildFailure, requestMetadata } from "@/core/http/api-response";
import type { Logger } from "@/core/logger";

/**
 * Terminal error boundary. Maps the error hierarchy to HTTP statuses and the
 * shared envelope; non-operational errors (bugs) never leak internals to clients.
 * Express identifies error middleware by arity — the 4-parameter signature is required.
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const appError =
      err instanceof ApplicationError
        ? err
        : new UnknownError(err instanceof Error ? err.message : String(err));

    logger.error("http.request.failed", {
      requestId: req.requestId,
      code: appError.code,
      message: appError.message,
      httpStatus: appError.httpStatus,
      isOperational: appError.isOperational,
      ...(appError.isOperational ? {} : { stack: (err instanceof Error ? err : appError).stack }),
    });

    const payload = {
      code: appError.code,
      message: appError.isOperational ? appError.message : "An unexpected error occurred.",
      ...(appError.isOperational && appError.details !== undefined
        ? { details: appError.details }
        : {}),
    };

    res
      .status(appError.httpStatus)
      .json(buildFailure(req.requestId, payload, requestMetadata(req)));
  };
}
