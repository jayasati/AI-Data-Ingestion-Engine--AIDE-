import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ApplicationError, UnknownError, ValidationError } from "@/core/errors";
import { buildFailure, requestMetadata } from "@/core/http/api-response";
import type { Logger } from "@/core/logger";

/**
 * Multer throws its own error class outside the ApplicationError hierarchy
 * (e.g. LIMIT_FILE_SIZE when an upload exceeds the configured limit). Mapped
 * here, once, so every upload-accepting route gets a clean 4xx instead of a
 * generic 500.
 */
function toApplicationError(err: unknown): ApplicationError {
  if (err instanceof ApplicationError) {
    return err;
  }
  if (err instanceof MulterError) {
    return new ValidationError(describeMulterError(err), { multerCode: err.code });
  }
  return new UnknownError(err instanceof Error ? err.message : String(err));
}

function describeMulterError(err: MulterError): string {
  if (err.code === "LIMIT_FILE_SIZE") {
    return "The uploaded file exceeds the maximum allowed size.";
  }
  return `File upload failed: ${err.message}`;
}

/**
 * Terminal error boundary. Maps the error hierarchy to HTTP statuses and the
 * shared envelope; non-operational errors (bugs) never leak internals to clients.
 * Express identifies error middleware by arity — the 4-parameter signature is required.
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const appError = toApplicationError(err);

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
