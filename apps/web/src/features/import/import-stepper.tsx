import type { StepStatus } from "@/types";
import { cn } from "@/lib/cn";

const STEPS = [
  { id: "upload", label: "Upload" },
  { id: "preview", label: "Preview" },
  { id: "ai", label: "AI Processing" },
  { id: "validation", label: "Validation" },
  { id: "results", label: "Results" },
] as const;

export type ImportStepId = (typeof STEPS)[number]["id"];

function statusFor(stepIndex: number, currentIndex: number): StepStatus {
  if (stepIndex < currentIndex) return "complete";
  if (stepIndex === currentIndex) return "current";
  return "upcoming";
}

export function ImportStepper({ currentStep }: { currentStep: ImportStepId }) {
  const currentIndex = STEPS.findIndex((step) => step.id === currentStep);

  return (
    <ol aria-label="Import progress" className="flex items-center gap-2 overflow-x-auto py-2">
      {STEPS.map((step, index) => {
        const status = statusFor(index, currentIndex);
        return (
          <li key={step.id} className="flex shrink-0 items-center gap-2">
            {index > 0 ? <span aria-hidden="true" className="h-px w-6 bg-border sm:w-10" /> : null}
            <span
              aria-current={status === "current" ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
                status === "current" &&
                  "border-accent-600 bg-accent-50 text-accent-700 dark:bg-accent-950 dark:text-accent-300",
                status === "complete" && "border-border bg-surface-muted text-foreground",
                status === "upcoming" && "border-border text-muted-foreground",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-xs",
                  status === "current" ? "bg-accent-600 text-white" : "bg-surface-muted",
                )}
              >
                {index + 1}
              </span>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
