/** Shared vocabulary used across the Execution Platform's subsystems. */

export type WorkerStatus = "idle" | "busy" | "stopped";

/** One worker's current state, as tracked by `ExecutionContext.runningWorkers`. */
export interface WorkerHandle {
  readonly workerId: string;
  readonly status: WorkerStatus;
  readonly currentBatchId: string | null;
}

export interface ExecutionTiming {
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly durationMs: number | null;
}

/** Free-form extensibility bag, same role as `PipelineContext.sharedState`. */
export type ExecutionMetadata = Readonly<Record<string, unknown>>;
