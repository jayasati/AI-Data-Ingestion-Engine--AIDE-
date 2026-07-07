"use client";

import { useCallback, useEffect, useState } from "react";
import type { HealthResponse } from "@aide/shared-types";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ApiClientError, fetchApiHealth } from "@/services/api-client";
import { useToast } from "@/providers/toast-provider";

type CheckState =
  | { status: "loading" }
  | { status: "ok"; health: HealthResponse }
  | { status: "error"; message: string };

export function ApiHealthWidget() {
  const [state, setState] = useState<CheckState>({ status: "loading" });
  const { toast } = useToast();

  const check = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const health = await fetchApiHealth();
      setState({ status: "ok", health });
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "Unexpected error while checking the API.";
      setState({ status: "error", message });
      toast({ title: "API health check failed", description: message, variant: "error" });
    }
  }, [toast]);

  useEffect(() => {
    void check();
  }, [check]);

  return (
    <div className="space-y-4">
      {state.status === "loading" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size="sm" /> Checking API…
        </p>
      ) : state.status === "error" ? (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          <p className="font-medium">API unreachable</p>
          <p className="mt-1">{state.message}</p>
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <HealthStat label="Status">
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
              {state.health.status}
            </span>
          </HealthStat>
          <HealthStat label="Service">{state.health.service}</HealthStat>
          <HealthStat label="Version">{state.health.version}</HealthStat>
          <HealthStat label="Uptime">{formatUptime(state.health.uptimeSeconds)}</HealthStat>
        </dl>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => void check()}
        isLoading={state.status === "loading"}
      >
        Re-check
      </Button>
    </div>
  );
}

function HealthStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function formatUptime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
