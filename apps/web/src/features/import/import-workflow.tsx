"use client";

import { useState } from "react";
import type { DatasetPreviewResponse } from "@aide/shared-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/providers/toast-provider";
import { ApiClientError } from "@/services/api-client";
import { submitPreview } from "@/services/preview-client";
import { ImportStepper, type ImportStepId } from "@/features/import/import-stepper";
import { UploadArea } from "@/features/import/upload-area";
import { PreviewPlaceholder } from "@/features/import/preview-placeholder";
import { PreviewResults } from "@/features/import/preview-results";
import { ProgressPlaceholder } from "@/features/import/progress-placeholder";
import { ResultPlaceholder } from "@/features/import/result-placeholder";

type ImportPhase = "idle" | "uploading" | "preview-ready" | "error";

const STEP_FOR_PHASE: Record<ImportPhase, ImportStepId> = {
  idle: "upload",
  uploading: "upload",
  "preview-ready": "preview",
  error: "upload",
};

/** Owns the Upload → Preview state for this volume; AI/Validation/Results stay placeholders. */
export function ImportWorkflow() {
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<DatasetPreviewResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileSelected = async (file: File) => {
    setPhase("uploading");
    setFileName(file.name);
    setErrorMessage(null);

    try {
      const result = await submitPreview(file);
      setPreview(result);
      setPhase("preview-ready");
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "Something went wrong while parsing the file.";
      setErrorMessage(message);
      setPreview(null);
      setPhase("error");
      toast({ title: "Preview failed", description: message, variant: "error" });
    }
  };

  return (
    <>
      <ImportStepper currentStep={STEP_FOR_PHASE[phase]} />
      <UploadArea
        onFileSelected={handleFileSelected}
        isSubmitting={phase === "uploading"}
        selectedFileName={fileName}
      />

      {phase === "preview-ready" && preview ? (
        <PreviewResults preview={preview} />
      ) : phase === "error" ? (
        <Card>
          <CardHeader>
            <CardTitle>Preview failed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <Button
              variant="secondary"
              onClick={() => {
                setPhase("idle");
                setErrorMessage(null);
              }}
            >
              Try a different file
            </Button>
          </CardContent>
        </Card>
      ) : (
        <PreviewPlaceholder />
      )}

      <ProgressPlaceholder />
      <ResultPlaceholder />
    </>
  );
}
