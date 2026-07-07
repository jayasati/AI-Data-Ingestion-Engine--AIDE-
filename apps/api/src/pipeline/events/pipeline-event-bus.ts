import type { PipelineEvent } from "@/pipeline/events/pipeline-event";

export type PipelineEventListener = (event: PipelineEvent) => void;

/**
 * In-process pub/sub only — deliberately not a message broker. Decouples the
 * runner from anything that reacts to progress (logging, a future SSE stream,
 * metrics) without the runner knowing any of those consumers exist.
 */
export class PipelineEventBus {
  private readonly listeners = new Set<PipelineEventListener>();

  subscribe(listener: PipelineEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(event: PipelineEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
