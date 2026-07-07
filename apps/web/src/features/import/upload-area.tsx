"use client";

import { useRef, useState, type DragEvent } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/providers/toast-provider";

export interface UploadAreaProps {
  onFileSelected: (file: File) => void;
  isSubmitting: boolean;
  selectedFileName: string | null;
}

/** Drag-and-drop / click-to-browse CSV picker. Only checks the extension client-side — the server is the real gate. */
export function UploadArea({ onFileSelected, isSubmitting, selectedFileName }: UploadAreaProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const selectFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast({
        title: "Unsupported file type",
        description: "Please choose a .csv file.",
        variant: "error",
      });
      return;
    }
    onFileSelected(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    if (isSubmitting) return;
    selectFile(event.dataTransfer.files[0]);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!isSubmitting) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      aria-busy={isSubmitting}
      className={`flex flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed p-10 text-center transition-colors ${
        isDragOver
          ? "border-accent-500 bg-accent-50 dark:bg-accent-950"
          : "border-border bg-surface"
      } ${isSubmitting ? "opacity-75" : ""}`}
    >
      {isSubmitting ? (
        <Spinner size="lg" className="text-accent-600" />
      ) : (
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
      )}
      <div>
        <p className="font-medium">
          {isSubmitting ? "Uploading and parsing…" : "Drag and drop your CSV here"}
        </p>
        {isSubmitting ? null : (
          <p className="mt-1 text-sm text-muted-foreground">
            or{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-medium text-accent-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent-600 dark:text-accent-400"
            >
              browse files
            </button>{" "}
            — .csv files only
          </p>
        )}
      </div>
      {selectedFileName ? (
        <p className="rounded-lg bg-surface-muted px-3 py-1.5 text-sm">
          Selected: <span className="font-medium">{selectedFileName}</span>
        </p>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        disabled={isSubmitting}
        className="sr-only"
        aria-label="Choose a CSV file"
        onChange={(event) => {
          selectFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
