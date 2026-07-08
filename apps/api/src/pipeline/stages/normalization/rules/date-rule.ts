import type { DateFieldDetails } from "@/pipeline/domain/normalization";
import { looksLikeDate } from "@/pipeline/ingestion/pattern-detectors";
import type {
  NormalizationRule,
  NormalizationRuleOutcome,
} from "@/pipeline/stages/normalization/rules/normalization-rule";

const RULE_ID = "date";

const MONTH_NAMES: Readonly<Record<string, number>> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

interface DateParseAttempt {
  readonly iso: string | null;
  readonly matchedFormat: string | null;
  readonly ambiguous: boolean;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const NOT_AMBIGUOUS: DateParseAttempt = { iso: null, matchedFormat: null, ambiguous: false };

/**
 * Supports the volume's named formats: ISO (YYYY-MM-DD), YYYY/MM/DD,
 * DD-MMM-YYYY, and numeric D?/M?/Y with any of / . - as separator (covers
 * both DD/MM/YYYY and MM/DD/YYYY). When a numeric date could be read either
 * way — both parts are <= 12 — this deliberately does NOT guess; see
 * `ambiguous` below.
 */
function attemptParse(value: string): DateParseAttempt {
  const trimmed = value.trim();

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(trimmed);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    return isValidCalendarDate(year, month, day)
      ? { iso: `${y}-${m}-${d}`, matchedFormat: "YYYY-MM-DD", ambiguous: false }
      : NOT_AMBIGUOUS;
  }

  const isoSlashMatch = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(trimmed);
  if (isoSlashMatch) {
    const [, y, m, d] = isoSlashMatch;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    return isValidCalendarDate(year, month, day)
      ? { iso: `${y}-${pad(month)}-${pad(day)}`, matchedFormat: "YYYY/MM/DD", ambiguous: false }
      : NOT_AMBIGUOUS;
  }

  const monthNameMatch = /^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{4})$/.exec(trimmed);
  if (monthNameMatch) {
    const [, d, monthName, y] = monthNameMatch;
    const month = MONTH_NAMES[monthName.slice(0, 3).toLowerCase()];
    const day = Number(d);
    const year = Number(y);
    return month && isValidCalendarDate(year, month, day)
      ? { iso: `${y}-${pad(month)}-${pad(day)}`, matchedFormat: "DD-MMM-YYYY", ambiguous: false }
      : NOT_AMBIGUOUS;
  }

  const numericMatch = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(trimmed);
  if (numericMatch) {
    const [, a, b, y] = numericMatch;
    const first = Number(a);
    const second = Number(b);
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const separator = trimmed.includes("/") ? "/" : trimmed.includes(".") ? "." : "-";

    const firstIsDay = first > 12 && second <= 12;
    const secondIsDay = second > 12 && first <= 12;

    if (firstIsDay && !secondIsDay && isValidCalendarDate(year, second, first)) {
      return {
        iso: `${year}-${pad(second)}-${pad(first)}`,
        matchedFormat: `DD${separator}MM${separator}YYYY`,
        ambiguous: false,
      };
    }
    if (secondIsDay && !firstIsDay && isValidCalendarDate(year, first, second)) {
      return {
        iso: `${year}-${pad(first)}-${pad(second)}`,
        matchedFormat: `MM${separator}DD${separator}YYYY`,
        ambiguous: false,
      };
    }
    if (first <= 12 && second <= 12) {
      // Both day-first and month-first are plausible calendar dates -- refuse to guess.
      return { iso: null, matchedFormat: null, ambiguous: true };
    }
    return NOT_AMBIGUOUS;
  }

  return NOT_AMBIGUOUS;
}

export class DateRule implements NormalizationRule {
  readonly id = RULE_ID;

  canApply(value: string): boolean {
    return looksLikeDate(value);
  }

  apply(value: string): NormalizationRuleOutcome {
    const attempt = attemptParse(value);

    if (attempt.iso) {
      const details: DateFieldDetails = {
        kind: "date",
        iso: attempt.iso,
        matchedFormat: attempt.matchedFormat,
      };
      return { value: attempt.iso, changed: attempt.iso !== value, details, confidence: 1 };
    }

    const details: DateFieldDetails = { kind: "date", iso: null, matchedFormat: null };

    if (attempt.ambiguous) {
      return {
        value,
        changed: false,
        details,
        confidence: 0.3,
        warnings: [
          {
            code: "AMBIGUOUS_DATE",
            message: `"${value}" could be read as either day-first or month-first; kept the original value rather than guessing.`,
          },
        ],
      };
    }

    return {
      value,
      changed: false,
      details,
      confidence: 0.2,
      warnings: [
        {
          code: "UNPARSEABLE_DATE",
          message: `"${value}" looked like a date but could not be parsed.`,
        },
      ],
    };
  }
}
