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
    src/components/       ui/ (Button, Card, Modal, Table, Spinner, Skeleton, Toast)
                          layout/ (Navbar, Footer), error boundary
    src/features/         import/ (upload area + placeholders), settings/
    src/providers/        ThemeProvider (light/dark/system), ToastProvider
    src/hooks/            useTheme, useToast, ...
    src/services/         api-client.ts — typed fetch over the shared ApiResponse envelope
    src/config/           Environment access (NEXT_PUBLIC_API_URL), app constants
    src/lib/              Framework-free utilities

  api/                    Express 5 backend (TypeScript, CommonJS build)
    src/config/           Typed, validated env loader (development | production | test)
    src/core/errors/      ApplicationError hierarchy (Validation, Configuration,
                          Infrastructure, NotFound, Unknown)
    src/core/logger/      Logger interface + structured JSON console implementation
    src/core/http/        ApiResponse envelope builders
    src/core/container.ts Composition root — constructor injection, no DI framework
    src/middleware/       request-id, request-logger, error-handler, not-found
    src/modules/          health/, upload/, preview/, import/ (routes+controller+service)
                          ai/, validation/, execution/ (reserved, land in later phases)
    src/types/            Express type augmentation (requestId)
    src/pipeline/         The processing engine — see src/pipeline/README.md.
                          domain/ (entities), contracts/ (StageResult, PipelineStage),
                          context/ (PipelineContext, ImportState machine), events/,
                          stages/{upload,csv-parsing,normalization} (real) +
                          {semantic-extraction,validation,aggregation} (placeholders),
                          runner/ (PipelineRunner). Framework-free; not yet wired to HTTP.

packages/
  shared-types/           Wire contracts shared by web + api: ApiResponse envelope,
                          UploadRequest/Response, ImportStatus, ResultSummary,
                          HealthResponse. The canonical CRM record schema lands here.
  validation/             Deterministic validation & trust engine (Phase 3)
  prompt/                 Prompt composition, versioning & registry (Phase 3)

infra/
  docker/                 Dockerfiles for api and web (finalized in ship phase)
  github-actions/         CI workflow template (copy to .github/workflows when on GitHub)

docs/                     Architecture & engineering handbook (20 chapters)
```

## Cross-cutting contracts

- **API envelope.** Every endpoint returns `{ success, data, error, metadata, timestamp, requestId }` (`ApiResponse<T>` in `@aide/shared-types`). Errors carry a stable machine-readable `code`; clients never parse messages.
- **Correlation.** Middleware assigns a `requestId` per request; it appears in every log line and every response.
- **Errors.** Backend code throws typed errors from the `ApplicationError` hierarchy; a single error-handler middleware maps them to HTTP statuses and the envelope. Unknown exceptions are wrapped, logged with stack, and returned as generic errors (no internals leak to clients).
- **Logging.** No `console.log`. Modules receive a `Logger` interface; the current implementation writes structured JSON lines. Swapping in a hosted provider later touches one file.
- **Configuration.** All runtime values come from validated env config (`src/config`). No hardcoded ports, origins, or levels.

## API surface (foundation phase)

| Method | Path          | Status      | Purpose                             |
| ------ | ------------- | ----------- | ----------------------------------- |
| GET    | `/health`     | Implemented | Service status, version, uptime     |
| POST   | `/upload`     | Placeholder | Accept CSV upload metadata          |
| POST   | `/preview`    | Placeholder | Parse + preview rows (no AI)        |
| POST   | `/import`     | Placeholder | Run the AI import pipeline          |
| GET    | `/import/:id` | Placeholder | Poll import status / result summary |

## Roadmap

| Phase    | Scope                                                                                                                                                                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 (done) | Monorepo foundation: apps, shared types, tooling, placeholder endpoints                                                                                                                                                                                                 |
| 2 (done) | Pipeline architecture: domain models, stage contracts, `PipelineContext` + state machine, event system, `PipelineRunner`, and real Upload/CSV Parsing/Normalization stages. Semantic Extraction, Validation, Aggregation are typed placeholders. Not yet wired to HTTP. |
| 3        | AI core: replace the Semantic Extraction placeholder with a provider adapter (OpenAI default), token-aware batching, 6-layer prompt, JSON repair/retry                                                                                                                  |
| 3.5      | Validation & trust engine: replace the Validation placeholder — schema/field/business-rule checks, confidence scoring                                                                                                                                                   |
| 4        | Frontend workflow: state-machine driven Upload → Preview → Confirm → Progress → Results; wire `POST /preview` and `POST /import` to `createPipelineRunner()`                                                                                                            |
| 5        | Ship: unit tests, Docker, CI, deployment (Vercel + Railway), README polish                                                                                                                                                                                              |
