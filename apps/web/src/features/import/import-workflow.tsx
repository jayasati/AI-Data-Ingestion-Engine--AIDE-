"use client";

import { useState } from "react";
import type { AIExtractResponse, DatasetPreviewResponse } from "@aide/shared-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/providers/toast-provider";
import { ApiClientError } from "@/services/api-client";
import { submitAIExtract } from "@/services/ai-extract-client";
import { submitPreview } from "@/services/preview-client";
import { AIExtractionSummary } from "@/features/import/ai-extraction-summary";
import { ImportStepper, type ImportStepId } from "@/features/import/import-stepper";
import { UploadArea } from "@/features/import/upload-area";
import { PreviewPlaceholder } from "@/features/import/preview-placeholder";
import { PreviewResults } from "@/features/import/preview-results";
import { ProgressPlaceholder } from "@/features/import/progress-placeholder";
import { ResultPlaceholder } from "@/features/import/result-placeholder";

type ImportPhase = "idle" | "uploading" | "preview-ready" | "error";
type AIExtractPhase = "idle" | "loading" | "ready" | "error";

const STEP_FOR_PHASE: Record<ImportPhase, ImportStepId> = {
  idle: "upload",
  uploading: "upload",
  "preview-ready": "preview",
  error: "upload",
};

/** Owns the Upload → Preview state for this volume; Validation/Results stay placeholders. */
export function ImportWorkflow() {
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DatasetPreviewResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiExtractPhase, setAIExtractPhase] = useState<AIExtractPhase>("idle");
  const [aiExtractResult, setAIExtractResult] = useState<AIExtractResponse | null>(null);
  const [aiExtractError, setAIExtractError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileSelected = async (file: File) => {
    setPhase("uploading");
    setFileName(file.name);
    setSelectedFile(file);
    setErrorMessage(null);
    setAIExtractPhase("idle");
    setAIExtractResult(null);
    setAIExtractError(null);

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

  const handleRunAIExtraction = async () => {
    if (!selectedFile) return;
    setAIExtractPhase("loading");
    setAIExtractError(null);

    try {
      const result = await submitAIExtract(selectedFile);
      setAIExtractResult(result);
      setAIExtractPhase("ready");
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "Something went wrong while running AI extraction.";
      setAIExtractError(message);
      setAIExtractResult(null);
      setAIExtractPhase("error");
      toast({ title: "AI extraction failed", description: message, variant: "error" });
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
        <>
          <PreviewResults preview={preview} />

          <Card>
            <CardHeader>
              <CardTitle>AI Extraction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Run the file through the AI Orchestration Platform to see how it would map onto the
                15 CRM fields, without committing an import.
              </p>
              <Button
                onClick={handleRunAIExtraction}
                isLoading={aiExtractPhase === "loading"}
                disabled={aiExtractPhase === "loading"}
              >
                Run AI Extraction
              </Button>
              {aiExtractPhase === "error" ? (
                <p className="text-sm text-red-600 dark:text-red-400">{aiExtractError}</p>
              ) : null}
            </CardContent>
          </Card>

          {aiExtractPhase === "ready" && aiExtractResult ? (
            <AIExtractionSummary result={aiExtractResult} />
          ) : null}
        </>
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
