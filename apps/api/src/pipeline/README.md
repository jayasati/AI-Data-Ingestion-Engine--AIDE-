# Pipeline Architecture

This module is the processing engine at the core of AIDE: a fixed sequence of
six stages that turns a raw upload into a validated, aggregated import
result. It is pure TypeScript — no Express, no HTTP, no UI — so every piece
is constructible and testable on its own.

Volume 1 built the surrounding application (Express app, modules, DI
container). Volume 2 built the pipeline itself: domain models, stage
contracts, the context that flows through every stage, the import lifecycle
state machine, an internal event system, and the runner that ties it all
together. Volume 5 replaced the Semantic Extraction placeholder with a real,
multi-provider AI Orchestration Platform (`apps/api/src/ai/` — see its own
README). Four of the six stages (Upload, CSV Parsing, Normalization,
Semantic Extraction) now have real logic; Validation and Aggregation remain
typed placeholders that fail loudly and deliberately until later volumes
replace them.

## Design principles

1. **Input → Pipeline → Output**, not Frontend → Backend → AI. The runner
   never knows AI exists; it only knows it is calling something that
   implements `PipelineStage<TInput, TOutput>`.
2. **Single responsibility per stage.** Each stage has one well-defined input
   type, one output type, and no knowledge of any other stage's internals.
3. **The runner owns the state machine.** No stage calls `context.transitionTo(...)`
   itself — some transitions (entering `AI_PROCESSING`) don't correspond to
   any single stage's output, so centralizing this in the runner avoids an
   inconsistent split of responsibility.
4. **A stage reports outcomes; it does not decide what happens next.** Every
   `execute()` call returns one of four outcomes — `success`, `warning`,
   `recoverable_failure`, `fatal_failure` — and the runner alone decides
   whether to continue or halt.
5. **Context is immutable.** Every stage receives a `PipelineContext` and
   returns a new one. Nothing holds a reference expecting it to mutate,
   which is what makes stages replayable and independently testable.

## Folder structure

```text
pipeline/
  domain/            Immutable entities and value objects (UploadedFile,
                      ParsedDataset, NormalizedDataset, SemanticExtractionResult,
                      ValidationResult, ImportSummary, ...)
  contracts/          StageResult, PipelineStage<TInput, TOutput>, ExecutionReport
  context/            PipelineContext (immutable), ImportState + transition rules
  events/              PipelineEvent union + in-process PipelineEventBus
  errors/               IllegalStateTransitionError, StageNotImplementedError
  stages/
    upload/                     real: verifies and wraps a raw upload
    csv-parsing/                real: delimiter detection, RFC 4180 tokenizer,
                                 header disambiguation, ragged-row recovery
    normalization/               real: whitespace, empty-token, Unicode/encoding
                                 cleanup — structural only, never semantic
    semantic-extraction/         real: delegates to an injected AIOrchestrator
                                 (apps/api/src/ai/) — provider-agnostic, see its README
    validation/                   placeholder — validation & trust engine volume
    aggregation/                   placeholder — statistics/aggregation volume
    shared/                       stage-result-factory (timing + StageResult builder)
  runner/
    pipeline-runner.ts            the orchestrator
    pipeline-stage-set.ts          the six-stage dependency contract
  create-pipeline-runner.ts        composition root (mirrors core/container.ts)
```

## Execution flow

```mermaid
sequenceDiagram
    participant Caller
    participant Runner as PipelineRunner
    participant Upload as UploadStage
    participant Parse as CsvParsingStage
    participant Normalize as NormalizationStage
    participant Extract as SemanticExtractionStage (real — AIOrchestrator)
    participant Validate as ValidationStage (placeholder)
    participant Aggregate as AggregationStage (placeholder)
    participant Bus as PipelineEventBus

    Caller->>Runner: run(rawUploadInput, configuration)
    Runner->>Runner: context = PipelineContext.create()
    Runner-->>Bus: ImportCreated

    Runner->>Upload: execute(rawUploadInput, context)
    Upload-->>Runner: StageExecution<UploadContext>
    Runner->>Runner: context.recordStageExecution(info)
    alt success or warning
        Runner->>Runner: context.transitionTo(UPLOADED)
        Runner-->>Bus: UploadCompleted
    else fatal / recoverable failure
        Runner->>Runner: context.transitionTo(FAILED)
        Runner-->>Bus: PipelineFailed
        Runner-->>Caller: PipelineRunResult (halted)
    end

    Runner->>Parse: execute(uploadContext, context)
    Parse-->>Runner: StageExecution<ParsedDataset>
    Note over Runner: same record / transition / halt-or-continue pattern

    Runner->>Normalize: execute(parsedDataset, context)
    Normalize-->>Runner: StageExecution<NormalizedDataset>

    Runner->>Runner: context.transitionTo(AI_PROCESSING)
    Runner->>Extract: execute(normalizedDataset, context)
    Extract->>Extract: AIOrchestrator.run({ normalizedDataset })
    alt AI call succeeds
        Extract-->>Runner: success/warning (SemanticExtractionResult)
        Runner->>Validate: execute(extractionResult, context)
        Validate-->>Runner: fatal_failure (STAGE_NOT_IMPLEMENTED)
        Runner->>Runner: context.transitionTo(FAILED)
        Runner-->>Bus: PipelineFailed
        Runner-->>Caller: PipelineRunResult (halted at validation)
    else AI call fails (provider_error / parser_error / timeout)
        Extract-->>Runner: fatal_failure
        Runner->>Runner: context.transitionTo(FAILED)
        Runner-->>Bus: PipelineFailed
        Runner-->>Caller: PipelineRunResult (halted at semantic-extraction)
    end
```

Today, every real run through `createPipelineRunner()` halts at Validation
with a `STAGE_NOT_IMPLEMENTED` `fatal_failure` — that is correct, expected
behavior until the validation & trust engine volume lands, not a bug. The
`ExecutionReport` shows Upload, CSV Parsing, Normalization, and Semantic
Extraction completing successfully with real metadata (including a full
`AIExecutionReport` on `context.sharedState`, readable via
`ai/shared-state.ts`'s `readAIExecutionReport()`), which is how the AI stage
is verified without going through Validation. `POST /ai/extract`
(`apps/api/src/modules/ai/`) exists specifically to exercise Semantic
Extraction over HTTP without needing Validation to succeed.

## Context flow

`PipelineContext` is created once per run (`PipelineContext.create`) and
threaded through every stage call. Each stage receives it, may read
`configuration` or `sharedState`, and returns a `StageExecution<TOutput>`
containing a (possibly updated) context — typically only `statistics` or
`sharedState` change inside a stage; `currentState` changes only in the
runner. After every stage call the runner folds the stage's `StageExecutionInfo`
into the context via `recordStageExecution`, which appends to `stageHistory`
and merges `warnings`/`errors` into the run-level totals. The final context
(and a derived `ExecutionReport`) is what `PipelineRunner.run()` returns.

## State machine

```text
CREATED → UPLOADED → PARSED → NORMALIZED → AI_PROCESSING → VALIDATED → AGGREGATED → COMPLETED
   ↓          ↓          ↓          ↓             ↓              ↓            ↓
   └──────────┴──────────┴──────────┴─────────────┴──────────────┴────────────┴──→ FAILED
                                (any non-terminal state, on halt)

Any non-terminal state → CANCELLED (not yet triggered by the runner; the
transition exists for a future cancellation endpoint)
```

Transitions are validated by `assertValidTransition` (`context/import-state.ts`);
an illegal transition throws `IllegalStateTransitionError` — a bug, not a
data problem, so it is non-operational and never exposed to a client as-is.

## Stage responsibilities

| Stage               | Input                      | Output                     | Status                                                                                         |
| ------------------- | -------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| Upload              | `RawUploadInput`           | `UploadContext`            | Real — verifies the request, wraps it as `UploadedFile`                                        |
| CSV Parsing         | `UploadContext`            | `ParsedDataset`            | Real — delimiter detection, quote-aware tokenizing, header disambiguation, ragged-row recovery |
| Normalization       | `ParsedDataset`            | `NormalizedDataset`        | Real — whitespace, empty-token, Unicode/encoding cleanup                                       |
| Semantic Extraction | `NormalizedDataset`        | `SemanticExtractionResult` | Real — delegates to an injected `AIOrchestrator` (`apps/api/src/ai/`)                          |
| Validation          | `SemanticExtractionResult` | `ValidationResult`         | Placeholder — validation & trust engine volume                                                 |
| Aggregation         | `ValidationResult`         | `ImportSummary`            | Placeholder — statistics/aggregation volume                                                    |

## Testability

Every stage is a plain class implementing `PipelineStage<TInput, TOutput>`.
None of them import Express, `http`, or anything from `apps/web`. A stage can
be instantiated and called directly:

```ts
const stage = new CsvParsingStage();
const context = PipelineContext.create("test-import", DEFAULT_PIPELINE_CONFIGURATION);
const { result } = await stage.execute(uploadContext, context);
```

`PipelineRunner` takes its six stages through the `PipelineStageSet`
constructor parameter, so a test can substitute a stub for any stage
(e.g. a `SemanticExtractionStage` stub that returns a canned `success`) without
touching the runner or any other stage.

## Not implemented in this volume

Per scope: no business rule validation, no CRM-mapping confidence/trust
scoring, no statistics aggregation. `StageOutcome` reserves
`recoverable_failure` for a future retry-aware runner, but today the runner
treats it identically to `fatal_failure` (halt) — see the comment on
`StageOutcome` in `contracts/stage-result.ts`; the AI Orchestration Platform
likewise attempts each provider call once (no retry loop) per its own scope
this volume. `createPipelineRunner()` is also not wired to `POST /import`
yet — `apps/api/src/modules/import` remains the Volume 1 placeholder.
`POST /preview` (Upload + CSV Parsing + Normalization) and `POST /ai/extract`
(the same plus Semantic Extraction) both call the individual stage classes
directly rather than through `PipelineRunner`, because `PipelineRunner`'s
fixed six-stage sequence would halt at Validation before either endpoint
could return a response.
