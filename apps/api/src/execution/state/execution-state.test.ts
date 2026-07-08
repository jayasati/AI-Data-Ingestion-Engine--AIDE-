import { describe, expect, it } from "vitest";
import {
  assertValidExecutionTransition,
  canTransitionExecution,
  ExecutionState,
  isTerminalExecutionState,
} from "@/execution/state/execution-state";
import { IllegalExecutionStateTransitionError } from "@/execution/errors/execution-errors";

describe("ExecutionState transitions", () => {
  it("allows the linear happy path: Created -> Queued -> Preparing -> Running -> Aggregating -> Completed", () => {
    const path = [
      ExecutionState.Created,
      ExecutionState.Queued,
      ExecutionState.Preparing,
      ExecutionState.Running,
      ExecutionState.Aggregating,
      ExecutionState.Completed,
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransitionExecution(path[i], path[i + 1])).toBe(true);
    }
  });

  it("allows Running to detour into Retrying and back", () => {
    expect(canTransitionExecution(ExecutionState.Running, ExecutionState.Retrying)).toBe(true);
    expect(canTransitionExecution(ExecutionState.Retrying, ExecutionState.Running)).toBe(true);
  });

  it("allows Running to detour into Paused and back", () => {
    expect(canTransitionExecution(ExecutionState.Running, ExecutionState.Paused)).toBe(true);
    expect(canTransitionExecution(ExecutionState.Paused, ExecutionState.Running)).toBe(true);
  });

  it("allows any non-terminal state to move toward Cancelling/Cancelled", () => {
    expect(canTransitionExecution(ExecutionState.Running, ExecutionState.Cancelling)).toBe(true);
    expect(canTransitionExecution(ExecutionState.Cancelling, ExecutionState.Cancelled)).toBe(true);
  });

  it("rejects skipping straight from Created to Running", () => {
    expect(canTransitionExecution(ExecutionState.Created, ExecutionState.Running)).toBe(false);
  });

  it("rejects any transition out of a terminal state", () => {
    expect(canTransitionExecution(ExecutionState.Completed, ExecutionState.Running)).toBe(false);
    expect(canTransitionExecution(ExecutionState.Failed, ExecutionState.Running)).toBe(false);
    expect(canTransitionExecution(ExecutionState.Cancelled, ExecutionState.Running)).toBe(false);
  });

  it("assertValidExecutionTransition throws IllegalExecutionStateTransitionError on an illegal edge", () => {
    expect(() =>
      assertValidExecutionTransition(ExecutionState.Created, ExecutionState.Completed),
    ).toThrow(IllegalExecutionStateTransitionError);
  });

  it("assertValidExecutionTransition does not throw on a legal edge", () => {
    expect(() =>
      assertValidExecutionTransition(ExecutionState.Created, ExecutionState.Queued),
    ).not.toThrow();
  });

  it("identifies Completed, Failed, and Cancelled as terminal", () => {
    expect(isTerminalExecutionState(ExecutionState.Completed)).toBe(true);
    expect(isTerminalExecutionState(ExecutionState.Failed)).toBe(true);
    expect(isTerminalExecutionState(ExecutionState.Cancelled)).toBe(true);
  });

  it("identifies every other state as non-terminal", () => {
    expect(isTerminalExecutionState(ExecutionState.Running)).toBe(false);
    expect(isTerminalExecutionState(ExecutionState.Queued)).toBe(false);
  });
});
