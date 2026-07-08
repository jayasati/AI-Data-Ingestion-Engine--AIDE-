# AI Module

`POST /ai/extract` — a diagnostic endpoint for the AI Orchestration Platform
(see `apps/api/src/ai/`). Accepts the same multipart upload as `/preview`,
runs Upload → CSV Parsing → Normalization → Semantic Extraction directly
through the real stage classes, and returns the extracted CRM-field records
plus an `AIExecutionReport` (provider, model, tokens, cost estimate, timing,
diagnostics — never the compiled prompt or raw provider response text).

Exists so the AI layer is testable over HTTP ahead of the Validation &
Aggregation volumes, which are still not-yet-implemented placeholder stages.
The real import flow will route through `PipelineRunner` (see
`pipeline/create-pipeline-runner.ts`) once those land — this endpoint is not
that flow, and does not persist or track import state.
