import { ConfigurationError } from "@/core/errors";

/**
 * Every tunable knob the Execution Platform needs, as one injectable
 * object — same pattern as `trust/config/trust-config.ts` and
 * `prompt/config/prompt-config.ts`. Nothing here is a stage-local constant;
 * a worker count, batch size, or timeout ceiling always arrives through this
 * object, never hardcoded at the call site.
 */
export interface ExecutionConfig {
  readonly workerCount: number;
  readonly batchSize: number;
  /** Ceiling on the whole execution, start to final aggregation. */
  readonly executionTimeoutMs: number;
  /** Ceiling on one batch's full worker pipeline (normalization through Trust Layer). */
  readonly batchTimeoutMs: number;
  /** Ceiling the Timeout Manager enforces around one batch's AI call — distinct from `AIConfig.timeoutMs`, the provider's own per-request timeout the orchestrator already applies. */
  readonly aiRequestTimeoutMs: number;
  readonly validationTimeoutMs: number;
  readonly aggregationTimeoutMs: number;
}

/** 2 workers, small batches — fast feedback loops, low resource use. */
export const DEV_EXECUTION_CONFIG: ExecutionConfig = {
  workerCount: 2,
  batchSize: 25,
  executionTimeoutMs: 10 * 60_000,
  batchTimeoutMs: 60_000,
  aiRequestTimeoutMs: 45_000,
  validationTimeoutMs: 15_000,
  aggregationTimeoutMs: 15_000,
};

/** 8 workers, larger batches — the default for a real deployment. */
export const PRODUCTION_EXECUTION_CONFIG: ExecutionConfig = {
  workerCount: 8,
  batchSize: 50,
  executionTimeoutMs: 30 * 60_000,
  batchTimeoutMs: 90_000,
  aiRequestTimeoutMs: 60_000,
  validationTimeoutMs: 20_000,
  aggregationTimeoutMs: 30_000,
};

/** 20 workers, largest batches — high-throughput imports. */
export const ENTERPRISE_EXECUTION_CONFIG: ExecutionConfig = {
  workerCount: 20,
  batchSize: 100,
  executionTimeoutMs: 60 * 60_000,
  batchTimeoutMs: 120_000,
  aiRequestTimeoutMs: 90_000,
  validationTimeoutMs: 30_000,
  aggregationTimeoutMs: 60_000,
};

export const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = DEV_EXECUTION_CONFIG;

const EXECUTION_PROFILES = ["dev", "production", "enterprise"] as const;
type ExecutionProfile = (typeof EXECUTION_PROFILES)[number];

const PROFILE_CONFIG: Readonly<Record<ExecutionProfile, ExecutionConfig>> = {
  dev: DEV_EXECUTION_CONFIG,
  production: PRODUCTION_EXECUTION_CONFIG,
  enterprise: ENTERPRISE_EXECUTION_CONFIG,
};

function readEnum<T extends string>(
  name: string,
  raw: string | undefined,
  allowed: readonly T[],
): T | undefined {
  if (raw === undefined || raw === "") {
    return undefined;
  }
  if ((allowed as readonly string[]).includes(raw)) {
    return raw as T;
  }
  throw new ConfigurationError(
    `${name} must be one of: ${allowed.join(", ")} (received "${raw}").`,
  );
}

function readPositiveInt(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ConfigurationError(`${name} must be a positive integer (received "${raw}").`);
  }
  return parsed;
}

/**
 * Resolves an `EXECUTION_PROFILE` (dev/production/enterprise) as the base,
 * then applies any individual `EXECUTION_*` overrides on top — mirroring
 * `loadAIConfig`'s fail-fast philosophy. Left unset, defaults to the dev
 * profile, so the app and its tests never require deployment-scale config
 * to run.
 */
export function loadExecutionConfig(env: NodeJS.ProcessEnv = process.env): ExecutionConfig {
  const profile = readEnum("EXECUTION_PROFILE", env.EXECUTION_PROFILE, EXECUTION_PROFILES);
  const base = profile ? PROFILE_CONFIG[profile] : DEFAULT_EXECUTION_CONFIG;

  return {
    workerCount: readPositiveInt(
      "EXECUTION_WORKER_COUNT",
      env.EXECUTION_WORKER_COUNT,
      base.workerCount,
    ),
    batchSize: readPositiveInt("EXECUTION_BATCH_SIZE", env.EXECUTION_BATCH_SIZE, base.batchSize),
    executionTimeoutMs: readPositiveInt(
      "EXECUTION_TIMEOUT_MS",
      env.EXECUTION_TIMEOUT_MS,
      base.executionTimeoutMs,
    ),
    batchTimeoutMs: readPositiveInt(
      "EXECUTION_BATCH_TIMEOUT_MS",
      env.EXECUTION_BATCH_TIMEOUT_MS,
      base.batchTimeoutMs,
    ),
    aiRequestTimeoutMs: readPositiveInt(
      "EXECUTION_AI_TIMEOUT_MS",
      env.EXECUTION_AI_TIMEOUT_MS,
      base.aiRequestTimeoutMs,
    ),
    validationTimeoutMs: readPositiveInt(
      "EXECUTION_VALIDATION_TIMEOUT_MS",
      env.EXECUTION_VALIDATION_TIMEOUT_MS,
      base.validationTimeoutMs,
    ),
    aggregationTimeoutMs: readPositiveInt(
      "EXECUTION_AGGREGATION_TIMEOUT_MS",
      env.EXECUTION_AGGREGATION_TIMEOUT_MS,
      base.aggregationTimeoutMs,
    ),
  };
}
