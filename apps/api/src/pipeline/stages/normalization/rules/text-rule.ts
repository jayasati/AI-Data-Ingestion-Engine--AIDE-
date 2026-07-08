import type {
  NormalizationRule,
  NormalizationRuleOutcome,
} from "@/pipeline/stages/normalization/rules/normalization-rule";

const RULE_ID = "text";

// Left/right curly double and single quotes. Built from code points (not
// literal glyphs) — see number-rule.ts / unicode-normalizer.ts for why.
const LEFT_DOUBLE_QUOTE = String.fromCharCode(0x201c);
const RIGHT_DOUBLE_QUOTE = String.fromCharCode(0x201d);
const LEFT_SINGLE_QUOTE = String.fromCharCode(0x2018);
const RIGHT_SINGLE_QUOTE = String.fromCharCode(0x2019);
const DOUBLE_QUOTE_PATTERN = new RegExp(`[${LEFT_DOUBLE_QUOTE}${RIGHT_DOUBLE_QUOTE}]`, "g");
const SINGLE_QUOTE_PATTERN = new RegExp(`[${LEFT_SINGLE_QUOTE}${RIGHT_SINGLE_QUOTE}]`, "g");

/**
 * Fallback for any value no content-shape rule claimed: normalizes curly
 * quotes to straight quotes. Deliberately does not touch capitalization or
 * collapse whitespace further (WhitespaceRule already owns that) — forcing
 * case on free text (notes, descriptions) would change user intent.
 */
export class TextRule implements NormalizationRule {
  readonly id = RULE_ID;

  canApply(): boolean {
    return true;
  }

  apply(value: string): NormalizationRuleOutcome {
    const normalized = value.replace(DOUBLE_QUOTE_PATTERN, '"').replace(SINGLE_QUOTE_PATTERN, "'");
    return { value: normalized, changed: normalized !== value };
  }
}
