import type {
  StageExecutionInfo,
  StageIssue,
  StageWarning,
} from "@/pipeline/contracts/stage-result";
import { assertValidTransition, ImportState } from "@/pipeline/context/import-state";
import type { PipelineConfiguration } from "@/pipeline/context/pipeline-configuration";

export interface PipelineStatistics {
  readonly [key: string]: number;
}

interface PipelineContextProps {
  readonly importId: string;
  readonly currentState: ImportState;
  readonly createdAt: string;
  readonly configuration: PipelineConfiguration;
  readonly statistics: PipelineStatistics;
  readonly warnings: readonly StageWarning[];
  readonly errors: readonly StageIssue[];
  readonly stageHistory: readonly StageExecutionInfo[];
  readonly sharedState: Readonly<Record<string, unknown>>;
}

/**
 * Immutable carrier passed to every stage and returned, updated, by every
 * stage. Every mutator returns a new instance — nothing in the pipeline holds
 * a reference to a context and expects it to change under it, which is what
 * makes stages safely testable in isolation and replayable for audits.
 */
export class PipelineContext {
  readonly importId: string;
  readonly currentState: ImportState;
  readonly createdAt: string;
  readonly configuration: PipelineConfiguration;
  readonly statistics: PipelineStatistics;
  readonly warnings: readonly StageWarning[];
  readonly errors: readonly StageIssue[];
  readonly stageHistory: readonly StageExecutionInfo[];
  readonly sharedState: Readonly<Record<string, unknown>>;

  private constructor(props: PipelineContextProps) {
    this.importId = props.importId;
    this.currentState = props.currentState;
    this.createdAt = props.createdAt;
    this.configuration = props.configuration;
    this.statistics = props.statistics;
    this.warnings = props.warnings;
    this.errors = props.errors;
    this.stageHistory = props.stageHistory;
    this.sharedState = props.sharedState;
  }

  static create(importId: string, configuration: PipelineConfiguration): PipelineContext {
    return new PipelineContext({
      importId,
      currentState: ImportState.Created,
      createdAt: new Date().toISOString(),
      configuration,
      statistics: {},
      warnings: [],
      errors: [],
      stageHistory: [],
      sharedState: {},
    });
  }

  transitionTo(nextState: ImportState): PipelineContext {
    assertValidTransition(this.currentState, nextState);
    return this.clone({ currentState: nextState });
  }

  /** Appends one stage's execution record and folds its warnings/errors into the run totals. */
  recordStageExecution(info: StageExecutionInfo): PipelineContext {
    return this.clone({
      stageHistory: [...this.stageHistory, info],
      warnings: [...this.warnings, ...info.warnings],
      errors: [...this.errors, ...info.errors],
    });
  }

  mergeStatistics(patch: Record<string, number>): PipelineContext {
    return this.clone({ statistics: { ...this.statistics, ...patch } });
  }

  withSharedState(key: string, value: unknown): PipelineContext {
    return this.clone({ sharedState: { ...this.sharedState, [key]: value } });
  }

  private clone(patch: Partial<PipelineContextProps>): PipelineContext {
    return new PipelineContext({ ...this.toProps(), ...patch });
  }

  private toProps(): PipelineContextProps {
    return {
      importId: this.importId,
      currentState: this.currentState,
      createdAt: this.createdAt,
      configuration: this.configuration,
      statistics: this.statistics,
      warnings: this.warnings,
      errors: this.errors,
      stageHistory: this.stageHistory,
      sharedState: this.sharedState,
    };
  }
}
