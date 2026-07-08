# Trust Layer

The LLM is an external dependency. Its output is never trusted automatically —
every extracted record is verified, repaired, scored, and approved (or
rejected, or skipped) before it becomes a CRM record a client can see. This
module is what makes that guarantee real, the same way `@/prompt` made
"prompts are versioned software artifacts" real in the previous volume.

Not:

```text
LLM → CRM
```

But:

```text
SemanticExtractionResult (already schema-mapped by ai/response/extraction-mapper.ts)
  → Schema Validator      (re-affirms the 15-field CRM contract, defensively)
  → Field Validator        (per-field format checks, independent of every other field)
  → Repair Engine           (deterministic fixes: enum closest-match, trim, normalize email/phone/date)
  → Business Rule Validator (re-validated against the *repaired* values)
  → Skip Engine              (no email AND no phone → skipped, before anything else matters)
  → Confidence Engine         (field, record, dataset)
  → Quality Score               (0-100)
  → Approval Engine              (approved / needs_review / rejected / skipped)
  → ValidationResult (pipeline/domain/validation.ts) → AggregationStage (a later volume)
```

`trust-engine.ts`'s `runTrustLayer()` is the one function that ties every
single-responsibility engine together — the Trust Layer's equivalent of
`prompt-compiler.ts`'s `compilePrompt()`.

## Folder structure

```text
trust/
  config/
    trust-config.ts            Every threshold/weight, one injectable object (DEFAULT_TRUST_CONFIG)
  parser/
    json-repair.ts              JSON Repair Engine: trailing commas, unbalanced brackets, smart
                                 quotes, invalid escapes, unquoted keys — all string-aware, so a
                                 repair pass never touches the *content* of a string value
  schema/
    schema-validator.ts         Re-affirms the 15-field CRM contract (missing/unknown/wrong-typed)
  fields/
    field-validators.ts         Per-field format checks (email, date, phone, enums, free text)
  business/
    business-rule-validator.ts  Cross-field business semantics: enum membership, multi-email/
                                 phone overflow-to-crm_note, the date rule
  skip/
    skip-engine.ts               No email AND no phone → skipped, with a reason
  repair/
    field-repair-engine.ts       Deterministic-only field repair; never invents data
  confidence/
    confidence-engine.ts         Field / Record / Dataset confidence
  quality/
    quality-score.ts             0-100, penalty-based, scaled by a confidence factor
  approval/
    approval-engine.ts           approved / needs_review / rejected / skipped + reason
  errors/
    error-classification.ts      Tags every stage's own issue shape with a TrustErrorCategory
  reports/
    validation-report.ts         Per-dataset rollup (buildDatasetSummary) over ValidatedRecords
  trust-engine.ts                runTrustLayer() — ties every engine together, per record
  index.ts                        Barrel export
```

Result types (`ApprovalStatus`, `ValidatedRecord`, `ValidationResult`,
`DatasetValidationSummary`, `FieldValidationReport`, `RepairAction`,
`ClassifiedIssue`, ...) live in `pipeline/domain/validation.ts`, not here —
the same layering `pipeline/domain/extraction.ts` already established: domain
types stay dependency-free so a higher-level module (`@/trust`, like `@/ai`
and `@/prompt` before it) can depend on them, never the reverse.

## Two repair engines, not one

The spec names both a "JSON Repair Engine" and a "Repair Engine" — these are
genuinely different concerns at different levels:

1. **`parser/json-repair.ts`** repairs malformed **JSON syntax** (raw text,
   before/during parsing) — a trailing comma, an unterminated string, smart
   quotes an LLM sometimes emits instead of straight ones. Wired into
   `AIOrchestrator.run()`: when `parseAIResponse` fails, `attemptJsonRepair`
   gets one attempt before the response is rejected outright as
   `parser_error`. A successful repair still produces `status: "success"` on
   the `AIExecutionReport`, with `repairMetadata.attempted/succeeded/
repairsApplied` recording what happened.
2. **`repair/field-repair-engine.ts`** repairs **field values** — after
   parsing already succeeded — per the assignment's own list: invalid enum →
   closest valid value, whitespace → trim, email/phone/date → normalize,
   everything else left alone. Runs inside `runTrustLayer()`, after schema
   validation and before business-rule validation (business rules are
   re-checked against the _repaired_ record, not the AI's raw output).

Both share one invariant: **repair never invents data.** A `null` value is
always returned `null`; a value the repair engine can't confidently fix (a
crm_status too far from any allowed value, a multi-value email/phone field —
splitting that correctly means writing to a _second_ field, `crm_note`,
which is out of scope for a single-field repair) is left untouched and the
validator's own warning stands instead.

## Why field confidence excludes missing fields from the record average

`confidence-engine.ts`'s `computeRecordConfidence()` averages only over
fields that actually carry a value. A record from a CSV that only ever had
Name/Email/Phone columns will legitimately have 12 of 15 fields null — that's
compliant with the assignment's own null-handling rule, not a defect, and
averaging in a 0 for every absent field would punish sparse-but-correct
records identically to sparse-and-wrong ones. Completeness is instead its own
dimension in the Quality Score (`missingFieldCount`, its own weight) — a
deliberate separation between "how much do we trust what's present" and
"how complete is this record."

## Quality Score shape

`quality-score.ts` computes a raw, penalty-based score (100 minus per-unit
deductions for missing fields, repairs, business-rule violations, and
validation errors, from `config.qualityScoreWeights`), then scales it by a
confidence factor — the weighted average of the record's own confidence and
the extraction's raw semantic-match average. A structurally clean record the
pipeline still isn't confident about can't score as high as one that's both
clean _and_ well-understood; a record riddled with business-rule violations
can't be rescued by high confidence alone, since the raw score is already low
before the confidence factor is even applied.

## Approval Engine ordering

`approval-engine.ts`'s `decideApproval()` checks, in order: skipped (nothing
left to approve) → hard schema/business errors (always rejected, no
confidence score outweighs an invalid enum or a broken schema) → meets the
approval bar on confidence + quality + repair count (approved) → below the
`needs_review` floor on either confidence or quality (rejected) → exceeds the
repair-count cap (needs_review) → the acceptable-but-uncertain middle band
(needs_review, the default). `"needs_review"` is a label only — no human
review _workflow_ exists yet (explicitly out of scope this volume).

## Wiring into the pipeline

`pipeline/stages/validation/validation-stage.ts` (previously a permanent
`STAGE_NOT_IMPLEMENTED` placeholder) now calls `runTrustLayer()` directly and
maps its `ValidationResult` onto `StageResult<ValidationResult>` — `outcome`
is `"warning"` when any record isn't `"approved"`, `"success"` otherwise;
never `"fatal_failure"`, since a rejected/skipped _record_ is expected,
routine output, not a stage failure. `AggregationStage` (folding
`ValidationResult` into a final `ImportSummary`) remains a placeholder —
explicitly out of scope this volume, per the spec's own "DO NOT IMPLEMENT"
list (no persistent storage, no analytics, no monitoring dashboard).

`modules/ai/ai-extract.service.ts` — the diagnostic `/ai/extract` HTTP
endpoint — now runs one stage further than before: Upload → CSV Parsing →
Normalization → Semantic Extraction → **Validation**, still stopping short of
Aggregation for the same reason it always has (that stage doesn't exist yet).

## Not implemented in this volume

Per scope: no retry engine, no parallel execution, no human review
_workflow_ (only the `needs_review` label — approving/rejecting a
needs_review record is a future volume's job), no persistent storage, no
monitoring dashboard, no analytics, no notification system.
