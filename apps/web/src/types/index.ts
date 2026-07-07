/** UI-local types. Cross-app contracts belong in @aide/shared-types instead. */

export type StepStatus = "complete" | "current" | "upcoming";

export interface WorkflowStep {
  id: string;
  label: string;
  description: string;
  status: StepStatus;
}
