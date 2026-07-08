import type { ExecutionEvent } from "@/execution/events/execution-event";

export type ExecutionEventListener = (event: ExecutionEvent) => void;

/** In-process pub/sub only, mirroring `PipelineEventBus` exactly — deliberately not a message broker. */
export class ExecutionEventBus {
  private readonly listeners = new Set<ExecutionEventListener>();

  subscribe(listener: ExecutionEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(event: ExecutionEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
