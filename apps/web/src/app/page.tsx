import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const WORKFLOW_STEPS = [
  {
    title: "Upload",
    description: "Drop any CSV export — Facebook Leads, Google Ads, CRM exports, spreadsheets.",
  },
  {
    title: "Preview",
    description: "Inspect parsed rows and file diagnostics before anything is processed.",
  },
  {
    title: "AI Processing",
    description: "An LLM maps unknown columns like “Mail ID” to the canonical CRM schema.",
  },
  {
    title: "Validation",
    description: "Every AI suggestion is verified against deterministic business rules.",
  },
  {
    title: "Results",
    description: "See imported and skipped records with reasons, then export the clean data.",
  },
];

const DIFFERENTIATORS = [
  {
    title: "Schema-free mapping",
    description:
      "No column configuration. The engine understands what your headers mean, whatever they are called.",
  },
  {
    title: "Validation first",
    description:
      "AI output is a proposal, not a fact — records only land after passing deterministic checks.",
  },
  {
    title: "Built for scale",
    description:
      "Batched, streaming processing designed to grow from a hundred rows to a hundred thousand.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="py-16 text-center sm:py-24">
        <p className="mb-4 text-sm font-medium tracking-wide text-accent-600 uppercase dark:text-accent-400">
          AI Data Ingestion Engine
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Turn any CSV into clean CRM data
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          AIDE imports lead data from arbitrary CSV formats and maps it into your CRM schema using
          AI — no column mapping, no templates, no manual cleanup.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/import" className={buttonStyles({ size: "lg" })}>
            Start importing
          </Link>
          <a href="#how-it-works" className={buttonStyles({ variant: "secondary", size: "lg" })}>
            How it works
          </a>
        </div>
      </section>

      <section id="how-it-works" aria-labelledby="how-it-works-heading" className="py-12">
        <h2 id="how-it-works-heading" className="text-center text-2xl font-semibold">
          How it works
        </h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {WORKFLOW_STEPS.map((step, index) => (
            <li key={step.title}>
              <Card className="h-full">
                <CardContent className="p-5">
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-600 text-sm font-semibold text-white"
                  >
                    {index + 1}
                  </span>
                  <h3 className="mt-3 font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="why-heading" className="py-12 pb-20">
        <h2 id="why-heading" className="text-center text-2xl font-semibold">
          Why AIDE
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {DIFFERENTIATORS.map((item) => (
            <Card key={item.title}>
              <CardContent className="p-6">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
