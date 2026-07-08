import { parsePhoneNumberFromString } from "libphonenumber-js";
import type { PhoneFieldDetails } from "@/pipeline/domain/normalization";
import { looksLikePhone } from "@/pipeline/ingestion/pattern-detectors";
import type {
  NormalizationRule,
  NormalizationRuleOutcome,
} from "@/pipeline/stages/normalization/rules/normalization-rule";

const RULE_ID = "phone";
const SPLIT_PATTERN = /[;,/]|\s+or\s+/i;

function splitPhones(value: string): string[] {
  return value
    .split(SPLIT_PATTERN)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Uses libphonenumber-js rather than hand-rolled regex: correctly parsing
 * international phone numbers (variable national-number lengths, country
 * calling codes, valid-range checks) is a genuinely hard, well-solved
 * problem — unlike CSV tokenizing, hand-rolling it would be strictly worse.
 * Only parses with confidence when the value carries its own country
 * context (a leading "+"); otherwise it extracts digits without guessing a
 * country, consistent with "do not guess ambiguous" data.
 */
export class PhoneRule implements NormalizationRule {
  readonly id = RULE_ID;

  canApply(value: string): boolean {
    return splitPhones(value).some((part) => looksLikePhone(part));
  }

  apply(value: string): NormalizationRuleOutcome {
    const [rawPrimary, ...additional] = splitPhones(value);

    let parsed;
    try {
      parsed = parsePhoneNumberFromString(rawPrimary);
    } catch {
      parsed = undefined;
    }

    if (parsed?.isValid()) {
      const details: PhoneFieldDetails = {
        kind: "phone",
        e164: parsed.number,
        countryCode: parsed.countryCallingCode ? `+${parsed.countryCallingCode}` : null,
        nationalNumber: parsed.nationalNumber,
        raw: rawPrimary,
        additional,
      };
      return { value: parsed.number, changed: true, details, confidence: 1 };
    }

    const digitsOnly = rawPrimary.replace(/\D/g, "");
    const details: PhoneFieldDetails = {
      kind: "phone",
      e164: null,
      countryCode: null,
      nationalNumber: digitsOnly,
      raw: rawPrimary,
      additional,
    };
    return {
      value: digitsOnly,
      changed: true,
      details,
      confidence: 0.5,
      warnings: [
        {
          code: "PHONE_COUNTRY_UNKNOWN",
          message: `Could not determine a country for "${rawPrimary}"; kept the digits without validation.`,
        },
      ],
    };
  }
}
