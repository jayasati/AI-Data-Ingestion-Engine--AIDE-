import type { BatchExecutionResult } from "@/execution/batch/batch-model";

/**
 * Internal lifecycle events, one per notable moment in an execution's life —
 * mirrors `pipeline/events/pipeline-event.ts` exactly (pure architecture, no
 * transport yet, so a future SSE/webhook/queue delivery layer can subscribe
 * without touching the Execution Engine, Worker Pool, or Retry Coordinator).
 */
export type ExecutionEvent =
  | {
      readonly type: "ExecutionStarted";
      readonly executionId: string;
      readonly importId: string;
      readonly occurredAt: string;
      readonly totalBatches: number;
    }
  | {
      readonly type: "BatchCreated";
      readonly executionId: string;
      readonly batchId: string;
      readonly occurredAt: string;
      readonly recordCount: number;
    }
  | {
      readonly type: "BatchStarted";
      readonly executionId: string;
      readonly batchId: string;
      readonly occurredAt: string;
      readonly workerId: string;
    }
  | {
      readonly type: "BatchCompleted";
      readonly executionId: string;
      readonly batchId: string;
      readonly occurredAt: string;
      readonly result: BatchExecutionResult;
    }
  | {
      readonly type: "WorkerAssigned";
      readonly executionId: string;
      readonly workerId: string;
      readonly batchId: string;
      readonly occurredAt: string;
    }
  | {
      readonly type: "RetryScheduled";
      readonly executionId: string;
      readonly batchId: string;
      readonly occurredAt: string;
      readonly attemptNumber: number;
    }
  | { readonly type: "ExecutionPaused"; readonly executionId: string; readonly occurredAt: string }
  | {
      readonly type: "ExecutionCancelled";
      readonly executionId: string;
      readonly occurredAt: string;
      readonly reason: string | null;
    }
  | {
      readonly type: "ExecutionCompleted";
      readonly executionId: string;
      readonly occurredAt: string;
      readonly durationMs: number;
    }
  | {
      readonly type: "ExecutionFailed";
      readonly executionId: string;
      readonly occurredAt: string;
      readonly reason: string;
    };

export type ExecutionEventType = ExecutionEvent["type"];
