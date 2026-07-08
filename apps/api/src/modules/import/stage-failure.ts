import { FileProcessingError } from "@/core/errors";
import type { StageExecutionInfo } from "@/pipeline";

/**
 * Maps a failed pipeline StageExecutionInfo onto the module's own error type,
 * keeping `core/errors` free of any dependency on pipeline internals. Each
 * module keeps its own copy rather than importing another module's (see
 * modules/ai/stage-failure.ts) — feature modules stay independent.
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
