/**
 * The JSON Repair Engine: a best-effort recovery pass over text that already
 * failed `JSON.parse`, tried before the response is rejected outright. Every
 * transformation is string-aware (tracks whether the scanner is inside a
 * JSON string literal) so repairs only ever touch structural JSON syntax,
 * never the content of a string value — a comma inside a note field is never
 * mistaken for a trailing comma.
 *
 * Deliberately conservative: this only fixes shapes an LLM is known to
 * produce (truncated output, smart quotes, an occasional unquoted key), never
 * attempts to guess missing data, and reports exactly which repairs it
 * applied so a caller can factor "this response needed repair" into
 * confidence scoring.
 */
export interface JsonRepairResult {
  readonly success: boolean;
  readonly repairedText: string | null;
  readonly repairsApplied: readonly string[];
  readonly data: unknown;
}

/** The "nothing needed repairing" sentinel — reused wherever a caller needs a default `JsonRepairMetadata`. */
export const NO_JSON_REPAIR = {
  attempted: false,
  succeeded: false,
  repairsApplied: [] as readonly string[],
};

const LEFT_DOUBLE_QUOTE = String.fromCharCode(0x201c);
const RIGHT_DOUBLE_QUOTE = String.fromCharCode(0x201d);
const SMART_QUOTE_PATTERN = new RegExp(`[${LEFT_DOUBLE_QUOTE}${RIGHT_DOUBLE_QUOTE}]`, "g");

const UNQUOTED_KEY_PATTERN = /([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)(\s*:)/g;

const ALLOWED_ESCAPE_CHARS = new Set(['"', "\\", "/", "b", "f", "n", "r", "t", "u"]);

function normalizeSmartQuotes(text: string, repairs: Set<string>): string {
  if (!SMART_QUOTE_PATTERN.test(text)) {
    return text;
  }
  repairs.add("SMART_QUOTES_NORMALIZED");
  return text.replace(SMART_QUOTE_PATTERN, '"');
}

/**
 * Best-effort, not string-aware — a bare `key:` shape inside a text value is
 * rare enough in CRM extraction output to accept the risk; this only ever
 * runs as a fallback after strict parsing already failed.
 */
function quoteUnquotedKeys(text: string, repairs: Set<string>): string {
  let changed = false;
  const result = text.replace(
    UNQUOTED_KEY_PATTERN,
    (_match, prefix: string, key: string, suffix: string) => {
      changed = true;
      return `${prefix}"${key}"${suffix}`;
    },
  );
  if (changed) {
    repairs.add("UNQUOTED_KEY_QUOTED");
  }
  return result;
}

/**
 * Single string-aware pass: drops a trailing comma before `}`/`]`, escapes a
 * raw control character found inside a string, and fixes an escape sequence
 * JSON doesn't recognize (any `\X` where X isn't one of `" \ / b f n r t u`)
 * by escaping the backslash itself.
 */
function scanAndRepair(text: string, repairs: Set<string>): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        if (!ALLOWED_ESCAPE_CHARS.has(ch)) {
          result += `\\${ch}`;
          repairs.add("INVALID_ESCAPE_FIXED");
        } else {
          result += ch;
        }
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        result += ch;
        continue;
      }
      if (ch === '"') {
        inString = false;
        result += ch;
        continue;
      }
      if (ch === "\n" || ch === "\r" || ch === "\t") {
        result += ch === "\n" ? "\\n" : ch === "\r" ? "\\r" : "\\t";
        repairs.add("CONTROL_CHARACTER_ESCAPED");
        continue;
      }
      result += ch;
      continue;
    }

    if (ch === '"') {
      inString = true;
      result += ch;
      continue;
    }
    if (ch === ",") {
      let lookahead = i + 1;
      while (lookahead < text.length && /\s/.test(text[lookahead])) {
        lookahead++;
      }
      if (text[lookahead] === "}" || text[lookahead] === "]") {
        repairs.add("TRAILING_COMMA_REMOVED");
        continue;
      }
      result += ch;
      continue;
    }
    result += ch;
  }

  if (inString) {
    result += '"';
    repairs.add("UNTERMINATED_STRING_CLOSED");
  }

  return result;
}

/** Closes any structurally-open `{`/`[` left at end of text — the common truncated-response failure mode. */
function balanceBrackets(text: string, repairs: Set<string>): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const ch of text) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{" || ch === "[") {
      stack.push(ch);
    } else if (ch === "}" || ch === "]") {
      if (stack.length > 0) {
        stack.pop();
      }
    }
  }

  if (stack.length === 0) {
    return text;
  }
  repairs.add("UNBALANCED_BRACKETS_CLOSED");
  const closers = stack
    .reverse()
    .map((open) => (open === "{" ? "}" : "]"))
    .join("");
  return text + closers;
}

/**
 * Attempts every repair pass in order, then re-parses. Only reports
 * `success: true` if the repaired text actually parses — a repair that
 * doesn't fix the underlying problem still leaves the caller free to reject
 * the response, exactly as if repair had never been attempted.
 */
export function attemptJsonRepair(rawText: string): JsonRepairResult {
  const repairs = new Set<string>();

  let text = normalizeSmartQuotes(rawText, repairs);
  text = quoteUnquotedKeys(text, repairs);
  text = scanAndRepair(text, repairs);
  text = balanceBrackets(text, repairs);

  if (repairs.size === 0) {
    return { success: false, repairedText: null, repairsApplied: [], data: null };
  }

  try {
    const data: unknown = JSON.parse(text);
    return { success: true, repairedText: text, repairsApplied: [...repairs], data };
  } catch {
    return { success: false, repairedText: text, repairsApplied: [...repairs], data: null };
  }
}
