import { ConsoleJsonLogger } from "@/core/logger/console-json-logger";
import type { LogContext, Logger, LogLevel } from "@/core/logger/logger";

export type { LogContext, Logger, LogLevel } from "@/core/logger/logger";

/** Single place that picks the logging provider; callers never construct one directly. */
export function createLogger(level: LogLevel, baseContext?: LogContext): Logger {
  return new ConsoleJsonLogger(level, baseContext);
}
