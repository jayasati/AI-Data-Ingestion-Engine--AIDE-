# AIDE — AI Data Ingestion Engine

AI-powered data-ingestion platform. First client: an **AI-powered CSV Importer** that extracts CRM lead information from arbitrary CSV formats and maps them into a canonical CRM schema using large language models.

> 🚧 Scaffold stage — no business logic yet. See `docs/` for the full architecture handbook.

## Monorepo layout

```text
apps/
  web/                  Next.js frontend
  api/                  Node.js + Express backend
packages/
  shared-types/         Canonical CRM schema types shared across apps
  validation/           Validation engine (deterministic, post-AI)
  prompt/               Prompt engineering & registry
infra/
  docker/               Dockerfiles (Phase 5)
  github-actions/       CI workflow templates (Phase 5)
docs/                   20-chapter architecture & engineering handbook
```

## Getting started

```bash
npm install
npm run build          # builds packages, then apps/api and apps/web
npm run dev:api        # Express API on http://localhost:4000 (GET /health)
npm run dev:web        # Next.js app on http://localhost:3000
npm run lint
npm run format
```

## Documentation

The architecture handbook lives in [`docs/`](docs/index.md) (20 chapters, GitBook TOC in [`docs/SUMMARY.md`](docs/SUMMARY.md)). Serve it locally with MkDocs:

```bash
pip install mkdocs-material
mkdocs serve
```
