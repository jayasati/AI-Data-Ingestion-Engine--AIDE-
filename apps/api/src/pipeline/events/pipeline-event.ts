import type { StageMetadata } from "@/pipeline/contracts/stage-result";
import type { ImportSummary } from "@/pipeline/domain/import-summary";

/**
 * Internal lifecycle events, one per state transition the runner performs.
 * No transport yet — see PipelineEventBus. This is pure architecture so a
 * future volume can add SSE/webhook/queue delivery without touching stages.
 */
export type PipelineEvent =
  | { readonly type: "ImportCreated"; readonly importId: string; readonly occurredAt: string }
  | {
      readonly type: "UploadCompleted";
      readonly importId: string;
      readonly occurredAt: string;
      readonly metadata: StageMetadata;
    }
  | {
      readonly type: "CSVParsed";
      readonly importId: string;
      readonly occurredAt: string;
      readonly metadata: StageMetadata;
    }
  | {
      readonly type: "NormalizationCompleted";
      readonly importId: string;
      readonly occurredAt: string;
      readonly metadata: StageMetadata;
    }
  | {
      readonly type: "PipelineCompleted";
      readonly importId: string;
      readonly occurredAt: string;
      readonly summary: ImportSummary;
    }
  | {
      readonly type: "PipelineFailed";
      readonly importId: string;
      readonly occurredAt: string;
      readonly reason: string;
    };

export type PipelineEventType = PipelineEvent["type"];
