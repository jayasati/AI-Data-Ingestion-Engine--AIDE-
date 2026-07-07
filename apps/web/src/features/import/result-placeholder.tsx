import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const METRICS = ["Imported", "Skipped", "Success rate", "Duration"] as const;

export function ResultPlaceholder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Results</CardTitle>
        <CardDescription>
          The final summary — imported records, skipped records with reasons, and export options —
          lands here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {METRICS.map((metric) => (
            <div key={metric} className="rounded-lg border border-border bg-surface-muted p-4">
              <dt className="text-xs text-muted-foreground">{metric}</dt>
              <dd className="mt-1 text-xl font-semibold">—</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
