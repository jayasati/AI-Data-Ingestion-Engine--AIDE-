import { FileProcessingError } from "@/core/errors";
import type { StageExecutionInfo } from "@/pipeline";

/**
 * Maps a failed pipeline StageExecutionInfo onto the module's own error type,
 * keeping `core/errors` free of any dependency on pipeline internals.
 */
export function toFileProcessingError(
  stageName: string,
  info: StageExecutionInfo,
): FileProcessingError {
  const primaryIssue = info.errors[0];
  const message =
    primaryIssue?.message ?? `Failed to process the file during the ${stageName} stage.`;
  return new FileProcessingError(message, { stage: stageName, issues: info.errors });
}
