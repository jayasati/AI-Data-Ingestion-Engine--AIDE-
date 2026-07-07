import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ProgressPlaceholder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Processing</CardTitle>
        <CardDescription>
          Live batch progress (batch X of N, imported and skipped counts) will stream here during AI
          extraction.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          aria-label="Import progress"
          className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
        >
          <div className="h-full w-0 rounded-full bg-accent-600" />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Waiting for an import to start…</p>
      </CardContent>
    </Card>
  );
}
