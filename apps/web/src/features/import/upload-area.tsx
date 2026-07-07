"use client";

import { useRef, useState, type DragEvent } from "react";
import { useToast } from "@/providers/toast-provider";

/**
 * Visual-only upload zone: selection state lives here, but nothing is sent
 * anywhere — the upload service wires in during the pipeline phase.
 */
export function UploadArea() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const selectFile = (name: string | undefined) => {
    if (!name) return;
    setFileName(name);
    toast({
      title: "File selected",
      description: "Processing is not wired up yet — this foundation build is UI only.",
      variant: "info",
    });
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    selectFile(event.dataTransfer.files[0]?.name);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed p-10 text-center transition-colors ${
        isDragOver
          ? "border-accent-500 bg-accent-50 dark:bg-accent-950"
          : "border-border bg-surface"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
        className="h-10 w-10 text-muted-foreground"
      >
        <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
      <div>
        <p className="font-medium">Drag and drop your CSV here</p>
        <p className="mt-1 text-sm text-muted-foreground">
          or{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-medium text-accent-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent-600 dark:text-accent-400"
          >
            browse files
          </button>{" "}
          — .csv up to 10 MB
        </p>
      </div>
      {fileName ? (
        <p className="rounded-lg bg-surface-muted px-3 py-1.5 text-sm">
          Selected: <span className="font-medium">{fileName}</span>
        </p>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label="Choose a CSV file"
        onChange={(event) => selectFile(event.target.files?.[0]?.name)}
      />
    </div>
  );
}
