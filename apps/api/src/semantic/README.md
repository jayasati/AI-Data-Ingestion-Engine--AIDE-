# Semantic Intelligence Engine

This module sits between the Normalization Engine (`pipeline/stages/
normalization`) and the AI Orchestrator (`ai/orchestrator`). Its job is to
_understand_ a normalized dataset before any LLM call is made — turning raw
headers and column values into ranked, confidence-scored CRM field
candidates — so the AI receives enriched context instead of a blank CSV, and
so headers the engine is already confident about never need an AI call at all.

Not:

```text
Normalized Dataset → LLM
```

But:

```text
Normalized Dataset
  → Header Intelligence     (what could this header mean?)
  → Column Intelligence     (what do the values actually look like?)
  → Dataset Intelligence    (what kind of dataset is this overall?)
  → Confidence Engine       (combine every signal into one score per field)
  → Hybrid Mapper           (route: skip AI, hint AI, or ask AI cold)
  → Semantic Report / AI Context Enrichment
```

Framework-free, side-effect-free, and stateless — the same dataset always
produces the same result (no Semantic Memory / learning across runs; that is
explicitly out of scope this volume).

## Folder structure

```text
semantic/
  types.ts                    SemanticFieldId vocabulary, ConfidenceTier
  config/
    semantic-config.ts        Every threshold/weight, one injectable object
  knowledge-base/
    semantic-clusters.ts      Static header-alias dictionary, per target field
    alias-registry.ts         Alias -> field lookup; static + custom/future aliases
    text-similarity.ts        Bigram Dice coefficient (fuzzy alias matching)
    knowledge-base.ts         SemanticKnowledgeBase: exact-alias + fuzzy lookup
  header-intelligence/
    header-analyzer.ts        Header text -> ranked candidate fields (hypotheses only)
  column-intelligence/
    entropy.ts                Normalized Shannon entropy of a column's values
    classifiers/               8 pluggable, value-only FieldClassifiers
    column-analyzer.ts         Per-column stats + classifier results
  dataset-intelligence/
    dataset-type-detector.ts  Header-vocabulary lexicon -> dataset type + confidence
  rules/                      6 independently-testable SemanticRules (see below)
  confidence/
    confidence-engine.ts      Combines rule signals into ranked FieldCandidates
  mapping/
    hybrid-mapper.ts          Confidence -> deterministic / ai_candidate / ai_required / unknown
  report/
    semantic-report-builder.ts  Rolls mappings up into one human-facing summary
  context/
    semantic-context-builder.ts  Result -> SemanticDatasetContext for the Prompt Compiler
  semantic-engine.ts           Single entry point: analyzeSemantics(dataset)
```

## Header Intelligence vs. Column Intelligence

Header Intelligence (`header-analyzer.ts`) only ever looks at header text. It
asks the knowledge base for exact-alias and fuzzy matches and returns ranked
_hypotheses_ — never a mapping. `"Customer Name"`, `"Buyer"`, `"Prospect"`,
and `"Lead"` all resolve to candidates for the `name` cluster; a header like
`"Contact"` fuzzy-matches several clusters at once and comes back
`isAmbiguous: true`.

Column Intelligence (`column-analyzer.ts`) is the opposite: it never looks at
the header, only at values, via the 8 `FieldClassifier`s in
`column-intelligence/classifiers/`. This is what resolves the header
architecture's canonical example — a column named `"Contact"` full of phone
numbers classifies as `phone` regardless of what the header says, because
`regexRule` reads column value evidence independently of header hints.

## The six confidence sources

Each is its own file under `rules/`, each independently unit-testable:

| Rule              | Source                         | What it does                                                                 |
| ----------------- | ------------------------------ | ---------------------------------------------------------------------------- |
| `headerRule`      | Header Similarity              | Fuzzy (non-exact) knowledge-base matches on the header text                  |
| `knowledgeRule`   | Knowledge Base                 | Exact alias matches — the strongest header-side signal                       |
| `regexRule`       | Regex Matches                  | Email/phone/date classifier hits — strong, header-independent                |
| `patternRule`     | Value Patterns                 | Name/company/status heuristics, plus location-gazetteer reinforcement        |
| `statisticalRule` | Column Statistics              | Confirms/refutes an _existing_ hypothesis by cardinality (never invents one) |
| `historicalRule`  | Historical Rules (placeholder) | Always returns no signals — reserved for a future Semantic Memory volume     |

## Confidence Engine

`computeHeaderConfidence` combines every non-statistical rule's signals per
candidate field via **noisy-OR** (`confidence = 1 - Π(1 - weight_i)`), so
independent corroborating evidence compounds (two 0.5s → 0.75) without a lone
weak signal ever being normalized up to 100%. `statisticalRule`'s signed
adjustment is then applied on top, scaled by `config.statisticalInfluence`,
and only to fields that already have a base hypothesis.

## Hybrid Mapping Engine

Routes each header by its top candidate's confidence:

- `>= highConfidenceThreshold` (default 0.85) → **deterministic** — map without AI.
- `>= mediumConfidenceThreshold` (default 0.4) → **ai_candidate** — AI gets ranked hints.
- otherwise → **ai_required** — AI gets little more than the header.
- no candidates at all → **unknown**.

## Configuration

Every threshold and per-rule-category weight lives in one object,
`DEFAULT_SEMANTIC_CONFIG` (`config/semantic-config.ts`). Every stage that
needs a knob takes it as an optional parameter defaulting to that object, so
a future customer override or benchmark sweep never touches matching logic.
New aliases (customer-specific or learned) register through
`SemanticKnowledgeBase.registerCustomAlias`, never by editing matching code.

## Wired into

- `ai/context/dataset-context-builder.ts` — `DatasetContext.semantics` is
  populated from `buildSemanticContext`, and `ai/orchestrator/
ai-orchestrator.ts` runs `analyzeSemantics` before compiling the prompt.
- `modules/preview/preview.service.ts` — runs `analyzeSemantics` right after
  normalization so the preview UI can show dataset type, field mapping
  confidence, and AI-required columns before any AI call happens.

## Not implemented in this volume

Per scope: no business/CRM validation, no repair engine, no retry engine, no
semantic memory (learning across imports), no human review, no parallel batch
execution, no final CRM approval. `historicalRule` is a documented no-op
placeholder for the semantic-memory idea, not a partial implementation of it.
