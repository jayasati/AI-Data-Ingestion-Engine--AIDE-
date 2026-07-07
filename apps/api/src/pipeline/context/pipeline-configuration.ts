/**
 * Run-scoped configuration threaded through every stage via the context.
 * Deliberately small in this volume — batching, AI timeouts, and retry policy
 * join here as their owning stages are implemented, never as stage-local constants.
 */
export interface PipelineConfiguration {
  readonly maxFileSizeBytes: number;
}

export const DEFAULT_PIPELINE_CONFIGURATION: PipelineConfiguration = {
  maxFileSizeBytes: 25 * 1024 * 1024,
};
