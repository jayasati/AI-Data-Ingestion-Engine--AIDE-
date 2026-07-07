const CANDIDATE_DELIMITERS = [",", ";", "|", "\t"] as const;
const SAMPLE_LINE_COUNT = 5;

/**
 * Votes among common delimiters using the first few lines. A delimiter only
 * qualifies if it appears in every sampled line (quote-aware, so a comma
 * inside a quoted field never counts); ties favor whichever is most frequent.
 */
export function detectDelimiter(content: string): string {
  const sampleLines = content
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim() !== "")
    .slice(0, SAMPLE_LINE_COUNT);

  if (sampleLines.length === 0) {
    return ",";
  }

  let bestDelimiter = ",";
  let bestScore = 0;

  for (const delimiter of CANDIDATE_DELIMITERS) {
    const counts = sampleLines.map((line) => countUnquotedOccurrences(line, delimiter));
    if (counts.some((count) => count === 0)) {
      continue;
    }
    const score = Math.min(...counts);
    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

function countUnquotedOccurrences(line: string, delimiter: string): number {
  let count = 0;
  let insideQuotes = false;
  for (const char of line) {
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === delimiter && !insideQuotes) {
      count += 1;
    }
  }
  return count;
}
