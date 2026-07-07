# @aide/api

Express + TypeScript backend foundation for AIDE. Modular, strictly layered, and
deliberately free of business logic — this phase ships the skeleton every later
engine (CSV, AI, validation, execution) plugs into.

## Module map

```text
src/
  config/        Typed env loader (development|production|test) + operational constants.
                 The only place process.env is read.
  core/
    errors/      ApplicationError hierarchy: Validation, NotFound, Configuration,
                 Infrastructure, Unknown. Error handler maps these to HTTP statuses.
    logger/      Logger interface + structured JSON stdout provider. No console.log.
    http/        ApiResponse envelope builders (success/data/error/metadata/timestamp/requestId).
    container.ts Composition root — concrete implementations chosen here only.
  middleware/    request-id (correlation), request-logger, not-found, error-handler.
  modules/
    health/      GET  /health          — live service info.
    upload/      POST /upload          — placeholder; multipart + file validation later.
    preview/     POST /preview         — placeholder; deterministic CSV preview later (AI-free).
    import/      POST /import, GET /import/:id — placeholder; dispatches to execution later.
    ai/          Reserved: provider adapter, batching, prompt assembly, JSON repair.
    validation/  Reserved: schema/field/business-rule validation of AI output.
    execution/   Reserved: lifecycle state machine, worker pool, retries, progress.
  types/         Express Request augmentation (requestId, startedAt).
  app.ts         App factory: middleware + routers, no listening.
  server.ts      Bootstrap + graceful shutdown (SIGTERM/SIGINT).
```

Every module follows routes → controller → service(interface); controllers stay
thin, services never import Express, and cross-app contracts come from
`@aide/shared-types`.

## Run

```bash
cp .env.example .env   # optional; sane defaults apply
npm run dev -w @aide/api
npm run build -w @aide/api && npm run start -w @aide/api
```
