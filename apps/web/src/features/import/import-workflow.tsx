"use client";

import { useEffect, useState } from "react";
import {
  ImportStatus,
  type AIExtractResponse,
  type DatasetPreviewResponse,
  type ResultSummary,
} from "@aide/shared-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/providers/toast-provider";
import { ApiClientError } from "@/services/api-client";
import { submitAIExtract } from "@/services/ai-extract-client";
import { fetchImportResult, submitImport } from "@/services/import-client";
import { submitPreview } from "@/services/preview-client";
import { AIExtractionSummary } from "@/features/import/ai-extraction-summary";
import { ImportProgress } from "@/features/import/import-progress";
import { ImportResultSummary } from "@/features/import/import-result-summary";
import { ImportStepper, type ImportStepId } from "@/features/import/import-stepper";
import { UploadArea } from "@/features/import/upload-area";
import { PreviewPlaceholder } from "@/features/import/preview-placeholder";
import { PreviewResults } from "@/features/import/preview-results";

type ImportPhase = "idle" | "uploading" | "preview-ready" | "error";
type AIExtractPhase = "idle" | "loading" | "ready" | "error";

const STEP_FOR_PHASE: Record<ImportPhase, ImportStepId> = {
  idle: "upload",
  uploading: "upload",
  "preview-ready": "preview",
  error: "upload",
};

const TERMINAL_STATUSES: ReadonlySet<ImportStatus> = new Set([
  ImportStatus.Completed,
  ImportStatus.Failed,
  ImportStatus.Cancelled,
]);

const POLL_INTERVAL_MS = 1000;

/** Owns the Upload -> Preview -> Full Import state for this volume. */
export function ImportWorkflow() {
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DatasetPreviewResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiExtractPhase, setAIExtractPhase] = useState<AIExtractPhase>("idle");
  const [aiExtractResult, setAIExtractResult] = useState<AIExtractResponse | null>(null);
  const [aiExtractError, setAIExtractError] = useState<string | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ResultSummary | null>(null);
  const [isStartingImport, setIsStartingImport] = useState(false);
  const { toast } = useToast();

  // Polls GET /import/:id every second while the import is still running —
  // no SSE/WebSocket infrastructure exists yet, and the Execution Platform's
  // own scope explicitly excludes standing up an external event bus this
  // volume, so polling is the simplest thing that's actually correct.
  useEffect(() => {
    if (!importId) {
      return;
    }
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const summary = await fetchImportResult(importId);
        if (cancelled) return;
        setImportSummary(summary);
        if (TERMINAL_STATUSES.has(summary.status) && intervalId !== null) {
          clearInterval(intervalId);
        }
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof ApiClientError ? error.message : "Lost contact with the import.";
        toast({ title: "Import status unavailable", description: message, variant: "error" });
      }
    };

    void poll();
    intervalId = setInterval(() => void poll(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [importId, toast]);

  const handleFileSelected = async (file: File) => {
    setPhase("uploading");
    setFileName(file.name);
    setSelectedFile(file);
    setErrorMessage(null);
    setAIExtractPhase("idle");
    setAIExtractResult(null);
    setAIExtractError(null);
    setImportId(null);
    setImportSummary(null);

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

  const handleRunFullImport = async () => {
    if (!selectedFile) return;
    setIsStartingImport(true);
    setImportSummary(null);

    try {
      const accepted = await submitImport(selectedFile);
      setImportId(accepted.importId);
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "Something went wrong starting the import.";
      toast({ title: "Import failed to start", description: message, variant: "error" });
    } finally {
      setIsStartingImport(false);
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

          <Card>
            <CardHeader>
              <CardTitle>Full Import</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Run the whole file through the Execution Platform — batched, concurrent workers,
                Trust Layer validation, and a final aggregated result.
              </p>
              <Button
                onClick={handleRunFullImport}
                isLoading={isStartingImport}
                disabled={
                  isStartingImport ||
                  (importSummary !== null && !TERMINAL_STATUSES.has(importSummary.status))
                }
              >
                Run Full Import
              </Button>
            </CardContent>
          </Card>
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

      <ImportProgress summary={importSummary} />
      <ImportResultSummary summary={importSummary} />
    </>
  );
}
