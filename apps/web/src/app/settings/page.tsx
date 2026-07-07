import type { Metadata } from "next";
import { AiConfigForm } from "@/features/settings/ai-config-form";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Configuration for the import engine. AI options unlock in a later phase.
        </p>
      </header>
      <AiConfigForm />
    </div>
  );
}
