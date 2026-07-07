import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_VERSION } from "@/config/app";
import { env } from "@/config/env";
import { ApiHealthWidget } from "@/features/health/api-health-widget";

export const metadata: Metadata = { title: "Health" };

// Module scope in a statically generated page — evaluated once at build time,
// which makes this the build timestamp rather than a request timestamp.
const BUILT_AT = new Date().toISOString();

export default function HealthPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Health</h1>
        <p className="mt-1 text-muted-foreground">
          Build information for this frontend and live status of the AIDE API.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Frontend build</CardTitle>
          <CardDescription>Values baked in when this deployment was built.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <BuildStat label="App version" value={`v${APP_VERSION}`} />
            <BuildStat label="Environment" value={process.env.NODE_ENV} />
            <BuildStat label="Built at" value={BUILT_AT} />
            <BuildStat label="API base URL" value={env.apiUrl} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API status</CardTitle>
          <CardDescription>Live check against the backend /health endpoint.</CardDescription>
        </CardHeader>
        <CardContent>
          <ApiHealthWidget />
        </CardContent>
      </Card>
    </div>
  );
}

function BuildStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium break-all">{value}</dd>
    </div>
  );
}
