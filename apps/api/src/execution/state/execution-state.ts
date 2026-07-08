import { IllegalExecutionStateTransitionError } from "@/execution/errors/execution-errors";

/**
 * Lifecycle of one Execution Platform run — distinct from `ImportState`
 * (`pipeline/context/import-state.ts`), which tracks which *data pipeline
 * stage* a single batch has reached. `ExecutionState` tracks what the
 * orchestration layer itself is doing: queuing, dispatching workers,
 * retrying, pausing, cancelling. One execution can (in principle) span many
 * batches, each internally progressing through its own `ImportState`-shaped
 * stage sequence via `pipeline/runner`'s stage contracts.
 */
export enum ExecutionState {
  Created = "CREATED",
  Queued = "QUEUED",
  Preparing = "PREPARING",
  Running = "RUNNING",
  Retrying = "RETRYING",
  Paused = "PAUSED",
  Cancelling = "CANCELLING",
  Cancelled = "CANCELLED",
  Aggregating = "AGGREGATING",
  Completed = "COMPLETED",
  Failed = "FAILED",
}

/**
 * Every non-terminal state can fail or move toward cancellation, same
 * philosophy as `import-state.ts`. `Running` is the only state with more
 * than one forward edge, because that is where the Worker Pool actually
 * dispatches batches and can therefore detour into `Retrying` (a batch
 * needs another attempt) or `Paused` (a future pause feature) before
 * reaching `Aggregating`.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<ExecutionState, readonly ExecutionState[]>> = {
  [ExecutionState.Created]: [
    ExecutionState.Queued,
    ExecutionState.Failed,
    ExecutionState.Cancelled,
  ],
  [ExecutionState.Queued]: [
    ExecutionState.Preparing,
    ExecutionState.Failed,
    ExecutionState.Cancelling,
    ExecutionState.Cancelled,
  ],
  [ExecutionState.Preparing]: [
    ExecutionState.Running,
    ExecutionState.Failed,
    ExecutionState.Cancelling,
  ],
  [ExecutionState.Running]: [
    ExecutionState.Retrying,
    ExecutionState.Paused,
    ExecutionState.Aggregating,
    ExecutionState.Cancelling,
    ExecutionState.Failed,
  ],
  [ExecutionState.Retrying]: [
    ExecutionState.Running,
    ExecutionState.Failed,
    ExecutionState.Cancelling,
  ],
  [ExecutionState.Paused]: [
    ExecutionState.Running,
    ExecutionState.Cancelling,
    ExecutionState.Failed,
  ],
  [ExecutionState.Cancelling]: [ExecutionState.Cancelled, ExecutionState.Failed],
  [ExecutionState.Cancelled]: [],
  [ExecutionState.Aggregating]: [ExecutionState.Completed, ExecutionState.Failed],
  [ExecutionState.Completed]: [],
  [ExecutionState.Failed]: [],
};

export function canTransitionExecution(from: ExecutionState, to: ExecutionState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertValidExecutionTransition(from: ExecutionState, to: ExecutionState): void {
  if (!canTransitionExecution(from, to)) {
    throw new IllegalExecutionStateTransitionError(from, to);
  }
}

/** States from which the execution can never resume forward progress. */
export function isTerminalExecutionState(state: ExecutionState): boolean {
  return ALLOWED_TRANSITIONS[state].length === 0;
}
