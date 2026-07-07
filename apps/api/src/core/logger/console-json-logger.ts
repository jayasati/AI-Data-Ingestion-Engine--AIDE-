import type { LogContext, Logger, LogLevel } from "@/core/logger/logger";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Structured JSON-lines logger writing to stdout — the 12-factor contract that
 * lets the platform (Docker, Railway, k8s) own log shipping.
 */
export class ConsoleJsonLogger implements Logger {
  constructor(
    private readonly minLevel: LogLevel,
    private readonly baseContext: LogContext = {},
  ) {}

  debug(message: string, context?: LogContext): void {
    this.write("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.write("info", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.write("warn", message, context);
  }

  error(message: string, context?: LogContext): void {
    this.write("error", message, context);
  }

  private write(level: LogLevel, message: string, context?: LogContext): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) {
      return;
    }
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.baseContext,
      ...context,
    });
    process.stdout.write(`${line}\n`);
  }
}
