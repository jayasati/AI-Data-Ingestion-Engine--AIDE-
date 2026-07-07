import type { Metadata } from "next";
import { ImportWorkflow } from "@/features/import/import-workflow";

export const metadata: Metadata = { title: "Import" };

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Import CSV</h1>
        <p className="mt-1 text-muted-foreground">
          Upload a CSV export and follow it through preview, AI mapping, and validation.
        </p>
      </header>

      <ImportWorkflow />
    </div>
  );
}
