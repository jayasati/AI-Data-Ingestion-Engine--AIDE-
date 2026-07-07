import { ConfigurationError } from "@/core/errors";
import type { LogLevel } from "@/core/logger/logger";

export type NodeEnvironment = "development" | "production" | "test";

export interface AppConfig {
  nodeEnv: NodeEnvironment;
  port: number;
  logLevel: LogLevel;
  corsOrigin: string;
  /** Operational constants centralized here so no module hardcodes them. */
  jsonBodyLimit: string;
  shutdownGraceMs: number;
}

export const SERVICE_NAME = "@aide/api";

const NODE_ENVIRONMENTS = ["development", "production", "test"] as const;
const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

const DEFAULTS: AppConfig = {
  nodeEnv: "development",
  port: 4000,
  logLevel: "info",
  corsOrigin: "http://localhost:3000",
  jsonBodyLimit: "2mb",
  shutdownGraceMs: 10_000,
};

function readEnum<T extends string>(
  name: string,
  raw: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (raw === undefined || raw === "") {
    return fallback;
  }
  if ((allowed as readonly string[]).includes(raw)) {
    return raw as T;
  }
  throw new ConfigurationError(
    `${name} must be one of: ${allowed.join(", ")} (received "${raw}").`,
  );
}

function readPort(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new ConfigurationError(
      `PORT must be an integer between 1 and 65535 (received "${raw}").`,
    );
  }
  return parsed;
}

/**
 * Reads and validates the environment exactly once at boot. Invalid config
 * throws (non-operational) so the process fails fast instead of running broken.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    nodeEnv: readEnum("NODE_ENV", env.NODE_ENV, NODE_ENVIRONMENTS, DEFAULTS.nodeEnv),
    port: readPort(env.PORT, DEFAULTS.port),
    logLevel: readEnum("LOG_LEVEL", env.LOG_LEVEL, LOG_LEVELS, DEFAULTS.logLevel),
    corsOrigin: env.CORS_ORIGIN ?? DEFAULTS.corsOrigin,
    jsonBodyLimit: DEFAULTS.jsonBodyLimit,
    shutdownGraceMs: DEFAULTS.shutdownGraceMs,
  };
}
