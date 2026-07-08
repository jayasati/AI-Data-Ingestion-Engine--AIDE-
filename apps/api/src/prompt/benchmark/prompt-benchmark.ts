import {
  compilePrompt,
  PromptCompilationError,
  type CompiledPrompt,
  type PromptCompilationInput,
} from "@/prompt/compiler/prompt-compiler";
import type { PromptConfig } from "@/prompt/config/prompt-config";

/** One named configuration to compile the same dataset/batch against. */
export interface PromptBenchmarkVariant {
  readonly label: string;
  readonly config?: Partial<PromptConfig>;
}

export interface PromptBenchmarkOutcome {
  readonly label: string;
  readonly valid: boolean;
  readonly templateId: string | null;
  readonly promptVersion: string | null;
  readonly promptHash: string | null;
  readonly contextSizeChars: number | null;
  readonly estimatedPromptTokens: number | null;
  readonly estimatedCompletionTokens: number | null;
  readonly estimatedCostUsd: number | null;
  readonly compilationTimeMs: number | null;
  readonly warnings: readonly string[];
  /** Only set when compilation threw — the `PromptCompilationError` message. */
  readonly error: string | null;
}

export interface PromptBenchmarkReport {
  readonly outcomes: readonly PromptBenchmarkOutcome[];
  /** Label of the best-ranked outcome, or null if every variant failed compilation. */
  readonly winner: string | null;
}

/**
 * Runs the same dataset/batch through `compilePrompt` under N named config
 * variants and ranks them — the "benchmarked before being promoted" step
 * `PromptRegistry.registerVersion`'s doc comment refers to, and the
 * `resolvePromptConfig`/`DEFAULT_PROMPT_CONFIG` "benchmark sweep" a config
 * override exists to support. Purely structural (token count, context size,
 * compilation time, validation warnings): no LLM calls and no accuracy/
 * confidence scoring, since that belongs to a future volume's validation
 * engine, not this one.
 */
export function benchmarkPromptVariants(
  baseInput: Omit<PromptCompilationInput, "config">,
  variants: readonly PromptBenchmarkVariant[],
): PromptBenchmarkReport {
  const outcomes = variants.map((variant) => runVariant(baseInput, variant));
  return { outcomes, winner: pickWinner(outcomes) };
}

/**
 * Diffs two already-compiled prompts — e.g. a candidate `registerVersion`
 * call against the entry's current version — so a promotion decision has a
 * number attached instead of a gut feeling.
 */
export interface PromptBenchmarkComparison {
  readonly tokenDeltaPct: number;
  readonly contextSizeDeltaChars: number;
  readonly compilationTimeDeltaMs: number;
  readonly warningCountDelta: number;
}

export function comparePromptCompilations(
  baseline: CompiledPrompt,
  candidate: CompiledPrompt,
): PromptBenchmarkComparison {
  const baselineTokens = baseline.metadata.estimatedPromptTokens;
  const candidateTokens = candidate.metadata.estimatedPromptTokens;
  return {
    tokenDeltaPct:
      baselineTokens === 0 ? 0 : ((candidateTokens - baselineTokens) / baselineTokens) * 100,
    contextSizeDeltaChars: candidate.metadata.contextSizeChars - baseline.metadata.contextSizeChars,
    compilationTimeDeltaMs: candidate.compilationTimeMs - baseline.compilationTimeMs,
    warningCountDelta: candidate.report.warnings.length - baseline.report.warnings.length,
  };
}

function runVariant(
  baseInput: Omit<PromptCompilationInput, "config">,
  variant: PromptBenchmarkVariant,
): PromptBenchmarkOutcome {
  try {
    const compiled = compilePrompt({ ...baseInput, config: variant.config });
    return toOutcome(variant.label, compiled);
  } catch (error) {
    if (error instanceof PromptCompilationError) {
      return {
        label: variant.label,
        valid: false,
        templateId: null,
        promptVersion: null,
        promptHash: null,
        contextSizeChars: null,
        estimatedPromptTokens: null,
        estimatedCompletionTokens: null,
        estimatedCostUsd: null,
        compilationTimeMs: null,
        warnings: error.validation.issues.map((issue) => issue.message),
        error: error.message,
      };
    }
    throw error;
  }
}

function toOutcome(label: string, compiled: CompiledPrompt): PromptBenchmarkOutcome {
  return {
    label,
    valid: compiled.validation.valid,
    templateId: compiled.templateId,
    promptVersion: compiled.promptVersion,
    promptHash: compiled.promptHash,
    contextSizeChars: compiled.metadata.contextSizeChars,
    estimatedPromptTokens: compiled.metadata.estimatedPromptTokens,
    estimatedCompletionTokens: compiled.metadata.estimatedCompletionTokens,
    estimatedCostUsd: compiled.metadata.estimatedCostUsd,
    compilationTimeMs: compiled.compilationTimeMs,
    warnings: compiled.report.warnings,
    error: null,
  };
}

/**
 * Lowest token count wins among valid, warning-free outcomes first; ties
 * (and any all-invalid field) fall back to fewer warnings, then faster
 * compilation, then declaration order — deterministic, so the same variant
 * set always benchmarks to the same winner.
 */
function pickWinner(outcomes: readonly PromptBenchmarkOutcome[]): string | null {
  const valid = outcomes.filter((outcome) => outcome.valid);
  if (valid.length === 0) {
    return null;
  }

  return valid.reduce((best, current) => {
    if (current.warnings.length !== best.warnings.length) {
      return current.warnings.length < best.warnings.length ? current : best;
    }
    if (current.estimatedPromptTokens !== best.estimatedPromptTokens) {
      return (current.estimatedPromptTokens ?? Infinity) < (best.estimatedPromptTokens ?? Infinity)
        ? current
        : best;
    }
    if (current.compilationTimeMs !== best.compilationTimeMs) {
      return (current.compilationTimeMs ?? Infinity) < (best.compilationTimeMs ?? Infinity)
        ? current
        : best;
    }
    return best;
  }).label;
}
