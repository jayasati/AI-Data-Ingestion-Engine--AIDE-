# AIDE — Architecture Overview

This document explains how the codebase is organized and why. The full design rationale lives in the 20-chapter handbook under [`docs/`](docs/index.md); this file is the practical map for working in the repository.

## Design principles

1. **Pipeline over request/response.** The system is a staged data pipeline (Upload → Preview → AI Processing → Validation → Results). Every stage has an explicit input/output contract; only the AI stage is non-deterministic.
2. **Deterministic before probabilistic.** Anything solvable with code (parsing, normalization, validation) never goes to the LLM.
3. **AI output is a proposal, not a fact.** Everything the model returns passes deterministic validation before it becomes a record.
4. **Clean Architecture.** Frameworks (Express, Next.js) are entry points, not the core. Dependencies point inward: controllers → services → domain. Infrastructure is swappable behind interfaces (logger, AI provider).
5. **Feature-based modularity.** Both apps are organized by feature/module, not by technical layer alone, so features grow independently.

## Repository layout

```text
apps/
  web/                    Next.js 15 frontend (App Router, Tailwind v4)
    src/app/              Routes: / (home), /import, /settings, /health
    src/components/       ui/ (Button, Card, Badge, Modal, Table, Spinner, Skeleton, Toast)
                          layout/ (Navbar, Footer), error boundary
    src/features/         import/ (upload area, import workflow, preview + normalization
                          results), settings/
    src/providers/        ThemeProvider (light/dark/system), ToastProvider
    src/hooks/            useTheme, useToast, ...
    src/services/         api-client.ts — typed fetch over the shared ApiResponse envelope;
                          preview-client.ts — multipart POST to /preview
    src/config/           Environment access (NEXT_PUBLIC_API_URL), app constants
    src/lib/              Framework-free utilities

  api/                    Express 5 backend (TypeScript, CommonJS build)
    src/config/           Typed, validated env loader (development | production | test)
    src/core/errors/      ApplicationError hierarchy (Validation, Configuration,
                          Infrastructure, NotFound, Unknown, FileProcessing)
    src/core/logger/      Logger interface + structured JSON console implementation
    src/core/http/        ApiResponse envelope builders
    src/core/container.ts Composition root — constructor injection, no DI framework
    src/middleware/       request-id, request-logger, error-handler (maps MulterError too), not-found
    src/modules/          health/ (real), upload/ (metadata-only placeholder),
                          preview/ (real — multer + CSV Ingestion Engine + Normalization
                          Engine, see below), import/ (placeholder).
                          ai/, validation/, execution/ (reserved).
    src/types/            Express type augmentation (requestId)
    src/pipeline/         The processing engine — see src/pipeline/README.md.
                          domain/ (entities), contracts/ (StageResult, PipelineStage),
                          context/ (PipelineContext, ImportState machine), events/,
                          stages/upload, stages/csv-parsing (real, see
                          src/pipeline/stages/csv-parsing — File Inspection, tokenizer,
                          header disambiguation, ragged-row recovery),
                          stages/normalization (real, rule-engine-based — see
                          src/pipeline/stages/normalization/README.md: 10 rule modules,
                          FieldNormalizationEngine, NormalizationReport),
                          stages/{semantic-extraction,validation,aggregation}
                          (placeholders), runner/ (PipelineRunner, not yet wired to HTTP),
                          ingestion/ (CSV Ingestion Engine — see src/pipeline/ingestion/
                          README.md: header engine, column profiler, dataset profiler,
                          dataset intelligence, preview generator, normalization summary.
                          Drives POST /preview.)
    apps/api/vitest.config.ts   Unit tests colocated next to source (*.test.ts)

packages/
  shared-types/           Wire contracts shared by web + api: ApiResponse envelope,
                          UploadRequest/Response, ImportStatus, ResultSummary,
                          HealthResponse, DatasetPreviewResponse (profile/metadata DTOs +
                          NormalizationSummaryDTO). The canonical CRM record schema lands here.
  validation/             Deterministic validation & trust engine (future phase)
  prompt/                 Prompt composition, versioning & registry (future phase)

infra/
  docker/                 Dockerfiles for api and web (finalized in ship phase)
  github-actions/         CI workflow template (copy to .github/workflows when on GitHub)

docs/                     Architecture & engineering handbook (20 chapters)
```

## Cross-cutting contracts

- **API envelope.** Every endpoint returns `{ success, data, error, metadata, timestamp, requestId }` (`ApiResponse<T>` in `@aide/shared-types`). Errors carry a stable machine-readable `code`; clients never parse messages.
- **Correlation.** Middleware assigns a `requestId` per request; it appears in every log line and every response.
- **Errors.** Backend code throws typed errors from the `ApplicationError` hierarchy; a single error-handler middleware maps them (and Multer's own `MulterError`) to HTTP statuses and the envelope. Unknown exceptions are wrapped, logged with stack, and returned as generic errors (no internals leak to clients).
- **Logging.** No `console.log`. Modules receive a `Logger` interface; the current implementation writes structured JSON lines. Swapping in a hosted provider later touches one file.
- **Configuration.** All runtime values come from validated env config (`src/config`). No hardcoded ports, origins, or levels.
- **Testing.** `apps/api` uses Vitest (`npm run test` / `test:watch`), test files colocated next to source (`*.test.ts`), excluded from the production build via `tsconfig.build.json`.

## API surface

| Method | Path          | Status      | Purpose                                                                                            |
| ------ | ------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| GET    | `/health`     | Implemented | Service status, version, uptime                                                                    |
| POST   | `/upload`     | Placeholder | Accept CSV upload metadata (JSON only, no file bytes)                                              |
| POST   | `/preview`    | Implemented | `multipart/form-data` (field `file`) → CSV Ingestion Engine + Normalization Engine results (no AI) |
| POST   | `/import`     | Placeholder | Run the AI import pipeline                                                                         |
| GET    | `/import/:id` | Placeholder | Poll import status / result summary                                                                |

## Roadmap

| Phase    | Scope                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 (done) | Monorepo foundation: apps, shared types, tooling, placeholder endpoints                                                                                                                                                                                                                                                                                                                                                  |
| 2 (done) | Pipeline architecture: domain models, stage contracts, `PipelineContext` + state machine, event system, `PipelineRunner`, and real Upload/CSV Parsing/Normalization stages (Normalization was structural-only in this phase). Semantic Extraction, Validation, Aggregation are typed placeholders. Not yet wired to HTTP.                                                                                                |
| 3 (done) | CSV Ingestion Engine: File Inspection (BOM/encoding), Header Engine, Column Profiler, Dataset Profiler (structural quality score), Dataset Intelligence (AI-free type hints), Preview Generator. Real `POST /preview` (multer, UTF-8/UTF-16 decoding). See `apps/api/src/pipeline/ingestion/README.md`.                                                                                                                  |
| 4 (done) | Data Normalization Engine: rule-engine architecture (10 independent rule modules — Unicode, Whitespace, Null, Email, Phone, Date, Number, Boolean, Text, Location), `FieldNormalizationEngine`, per-field metadata + confidence, dataset-level `NormalizationReport`. `POST /preview` now also runs Normalization and returns a health score + field issues. See `apps/api/src/pipeline/stages/normalization/README.md`. |
| 5        | AI core: replace the Semantic Extraction placeholder with a provider adapter (OpenAI default), token-aware batching, 6-layer prompt, JSON repair/retry                                                                                                                                                                                                                                                                   |
| 5.5      | Validation & trust engine: replace the Validation placeholder — schema/field/business-rule checks, confidence scoring                                                                                                                                                                                                                                                                                                    |
| 6        | Frontend workflow: state-machine driven Upload → Preview → Confirm → Progress → Results; wire `POST /import` to `createPipelineRunner()`                                                                                                                                                                                                                                                                                 |
| 7        | Ship: Docker, CI, deployment (Vercel + Railway), README polish                                                                                                                                                                                                                                                                                                                                                           |
