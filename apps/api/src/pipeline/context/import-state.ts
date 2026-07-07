import { IllegalStateTransitionError } from "@/pipeline/errors";

/** Lifecycle of one import, mirrored 1:1 by the pipeline stage sequence. */
export enum ImportState {
  Created = "CREATED",
  Uploaded = "UPLOADED",
  Parsed = "PARSED",
  Normalized = "NORMALIZED",
  AIProcessing = "AI_PROCESSING",
  Validated = "VALIDATED",
  Aggregated = "AGGREGATED",
  Completed = "COMPLETED",
  Failed = "FAILED",
  Cancelled = "CANCELLED",
}

/**
 * The only legal edges in the lifecycle graph. Every state can fail or be
 * cancelled; forward progress is strictly linear, matching the fixed stage
 * sequence — no stage may be skipped or reordered.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<ImportState, readonly ImportState[]>> = {
  [ImportState.Created]: [ImportState.Uploaded, ImportState.Failed, ImportState.Cancelled],
  [ImportState.Uploaded]: [ImportState.Parsed, ImportState.Failed, ImportState.Cancelled],
  [ImportState.Parsed]: [ImportState.Normalized, ImportState.Failed, ImportState.Cancelled],
  [ImportState.Normalized]: [ImportState.AIProcessing, ImportState.Failed, ImportState.Cancelled],
  [ImportState.AIProcessing]: [ImportState.Validated, ImportState.Failed, ImportState.Cancelled],
  [ImportState.Validated]: [ImportState.Aggregated, ImportState.Failed, ImportState.Cancelled],
  [ImportState.Aggregated]: [ImportState.Completed, ImportState.Failed, ImportState.Cancelled],
  [ImportState.Completed]: [],
  [ImportState.Failed]: [],
  [ImportState.Cancelled]: [],
};

export function canTransition(from: ImportState, to: ImportState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertValidTransition(from: ImportState, to: ImportState): void {
  if (!canTransition(from, to)) {
    throw new IllegalStateTransitionError(from, to);
  }
}

/** States from which the import can never resume forward progress. */
export function isTerminalState(state: ImportState): boolean {
  return ALLOWED_TRANSITIONS[state].length === 0;
}
