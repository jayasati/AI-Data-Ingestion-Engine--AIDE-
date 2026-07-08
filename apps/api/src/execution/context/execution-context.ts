import type { StageIssue, StageWarning } from "@/pipeline/contracts/stage-result";
import { assertValidExecutionTransition, ExecutionState } from "@/execution/state/execution-state";
import {
  DEFAULT_EXECUTION_CONFIG,
  type ExecutionConfig,
} from "@/execution/config/execution-config";
import type { ExecutionMetadata, WorkerHandle } from "@/execution/types";

interface ExecutionContextProps {
  readonly importId: string;
  readonly executionId: string;
  readonly currentState: ExecutionState;
  readonly currentStage: string | null;
  readonly currentBatchId: string | null;
  readonly completedBatchIds: readonly string[];
  readonly runningWorkers: readonly WorkerHandle[];
  readonly configuration: ExecutionConfig;
  readonly metrics: Readonly<Record<string, number>>;
  readonly warnings: readonly StageWarning[];
  readonly errors: readonly StageIssue[];
  readonly startedAt: string;
  readonly cancellationRequested: boolean;
  readonly cancellationReason: string | null;
  readonly metadata: ExecutionMetadata;
}

/**
 * Immutable carrier every Execution Platform subsystem receives, mirroring
 * `PipelineContext`'s clone-on-mutate style exactly: every mutator returns a
 * new instance, so no subsystem holds a reference expecting it to change
 * under it. Knows nothing about CRM business rules — only about the shape of
 * an execution in progress (state, current batch, worker roster, running
 * metrics, accumulated warnings/errors, cancellation status).
 */
export class ExecutionContext {
  readonly importId: string;
  readonly executionId: string;
  readonly currentState: ExecutionState;
  readonly currentStage: string | null;
  readonly currentBatchId: string | null;
  readonly completedBatchIds: readonly string[];
  readonly runningWorkers: readonly WorkerHandle[];
  readonly configuration: ExecutionConfig;
  readonly metrics: Readonly<Record<string, number>>;
  readonly warnings: readonly StageWarning[];
  readonly errors: readonly StageIssue[];
  readonly startedAt: string;
  readonly cancellationRequested: boolean;
  readonly cancellationReason: string | null;
  readonly metadata: ExecutionMetadata;

  private constructor(props: ExecutionContextProps) {
    this.importId = props.importId;
    this.executionId = props.executionId;
    this.currentState = props.currentState;
    this.currentStage = props.currentStage;
    this.currentBatchId = props.currentBatchId;
    this.completedBatchIds = props.completedBatchIds;
    this.runningWorkers = props.runningWorkers;
    this.configuration = props.configuration;
    this.metrics = props.metrics;
    this.warnings = props.warnings;
    this.errors = props.errors;
    this.startedAt = props.startedAt;
    this.cancellationRequested = props.cancellationRequested;
    this.cancellationReason = props.cancellationReason;
    this.metadata = props.metadata;
  }

  static create(
    importId: string,
    executionId: string,
    configuration: ExecutionConfig = DEFAULT_EXECUTION_CONFIG,
  ): ExecutionContext {
    return new ExecutionContext({
      importId,
      executionId,
      currentState: ExecutionState.Created,
      currentStage: null,
      currentBatchId: null,
      completedBatchIds: [],
      runningWorkers: [],
      configuration,
      metrics: {},
      warnings: [],
      errors: [],
      startedAt: new Date().toISOString(),
      cancellationRequested: false,
      cancellationReason: null,
      metadata: {},
    });
  }

  transitionTo(next: ExecutionState): ExecutionContext {
    assertValidExecutionTransition(this.currentState, next);
    return this.clone({ currentState: next });
  }

  withCurrentStage(stage: string | null): ExecutionContext {
    return this.clone({ currentStage: stage });
  }

  withCurrentBatch(batchId: string | null): ExecutionContext {
    return this.clone({ currentBatchId: batchId });
  }

  completeBatch(batchId: string): ExecutionContext {
    return this.clone({ completedBatchIds: [...this.completedBatchIds, batchId] });
  }

  withRunningWorkers(workers: readonly WorkerHandle[]): ExecutionContext {
    return this.clone({ runningWorkers: workers });
  }

  mergeMetrics(patch: Record<string, number>): ExecutionContext {
    return this.clone({ metrics: { ...this.metrics, ...patch } });
  }

  addWarnings(warnings: readonly StageWarning[]): ExecutionContext {
    if (warnings.length === 0) {
      return this;
    }
    return this.clone({ warnings: [...this.warnings, ...warnings] });
  }

  addErrors(errors: readonly StageIssue[]): ExecutionContext {
    if (errors.length === 0) {
      return this;
    }
    return this.clone({ errors: [...this.errors, ...errors] });
  }

  requestCancellation(reason: string | null = null): ExecutionContext {
    return this.clone({ cancellationRequested: true, cancellationReason: reason });
  }

  withMetadata(key: string, value: unknown): ExecutionContext {
    return this.clone({ metadata: { ...this.metadata, [key]: value } });
  }

  private clone(patch: Partial<ExecutionContextProps>): ExecutionContext {
    return new ExecutionContext({ ...this.toProps(), ...patch });
  }

  private toProps(): ExecutionContextProps {
    return {
      importId: this.importId,
      executionId: this.executionId,
      currentState: this.currentState,
      currentStage: this.currentStage,
      currentBatchId: this.currentBatchId,
      completedBatchIds: this.completedBatchIds,
      runningWorkers: this.runningWorkers,
      configuration: this.configuration,
      metrics: this.metrics,
      warnings: this.warnings,
      errors: this.errors,
      startedAt: this.startedAt,
      cancellationRequested: this.cancellationRequested,
      cancellationReason: this.cancellationReason,
      metadata: this.metadata,
    };
  }
}
