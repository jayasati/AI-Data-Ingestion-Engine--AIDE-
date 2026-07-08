import type { NumberFieldDetails } from "@/pipeline/domain/normalization";
import { looksLikeNumeric } from "@/pipeline/ingestion/pattern-detectors";
import type {
  NormalizationRule,
  NormalizationRuleOutcome,
} from "@/pipeline/stages/normalization/rules/normalization-rule";

const RULE_ID = "number";

// Dollar, Euro, Pound, Rupee. Built from code points (not literal glyphs) so
// the source file cannot end up silently containing a mis-encoded character
// — see unicode-normalizer.ts for the same precaution and why it matters here.
const DOLLAR = "$";
const EURO = String.fromCharCode(0x20ac);
const POUND = String.fromCharCode(0x00a3);
const RUPEE = String.fromCharCode(0x20b9);
const CURRENCY_SYMBOLS: readonly string[] = [DOLLAR, EURO, POUND, RUPEE];
const CURRENCY_SYMBOL_PATTERN = new RegExp(`[${CURRENCY_SYMBOLS.join("")}]`, "g");

function extractCurrencySymbol(value: string): string | null {
  return (
    CURRENCY_SYMBOLS.find((symbol) => value.startsWith(symbol) || value.endsWith(symbol)) ?? null
  );
}

/** Strips currency symbols, thousands separators, and a trailing percent sign, then parses. */
export class NumberRule implements NormalizationRule {
  readonly id = RULE_ID;

  canApply(value: string): boolean {
    return looksLikeNumeric(value);
  }

  apply(value: string): NormalizationRuleOutcome {
    const trimmed = value.trim();
    const isPercentage = trimmed.endsWith("%");
    const currencySymbol = extractCurrencySymbol(trimmed);

    const stripped = trimmed
      .replace(CURRENCY_SYMBOL_PATTERN, "")
      .replace(/%$/, "")
      .replace(/,/g, "");
    const numericValue = Number(stripped);

    if (!Number.isFinite(numericValue) || stripped.length === 0) {
      const details: NumberFieldDetails = {
        kind: "number",
        value: null,
        currencySymbol,
        isPercentage,
      };
      return {
        value,
        changed: false,
        details,
        confidence: 0.2,
        warnings: [
          {
            code: "UNPARSEABLE_NUMBER",
            message: `"${value}" looked numeric but could not be parsed.`,
          },
        ],
      };
    }

    const details: NumberFieldDetails = {
      kind: "number",
      value: numericValue,
      currencySymbol,
      isPercentage,
    };
    const normalized = String(numericValue);
    return { value: normalized, changed: normalized !== value, details, confidence: 1 };
  }
}
