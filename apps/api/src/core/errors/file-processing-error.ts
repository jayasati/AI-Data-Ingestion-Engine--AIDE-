import { ApplicationError } from "@/core/errors/application-error";

/** A file failed deterministic processing (upload verification or CSV parsing). */
export class FileProcessingError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, "FILE_PROCESSING_ERROR", 422, true, details);
  }
}
