/**
 * RFC 4180–style tokenizer: quote-aware, handles delimiters and newlines
 * embedded in quoted fields, and doubled quotes (`""`) as an escaped quote.
 * Operates on the whole content at once (not line-by-line) specifically so an
 * embedded newline inside a quoted field is never mistaken for a row break.
 */
export function tokenizeCsv(content: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let insideQuotes = false;
  let i = 0;
  const length = content.length;

  const pushField = (): void => {
    record.push(field);
    field = "";
  };
  const pushRecord = (): void => {
    pushField();
    records.push(record);
    record = [];
  };

  while (i < length) {
    const char = content[i];

    if (insideQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        insideQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"' && field === "") {
      insideQuotes = true;
      i += 1;
      continue;
    }
    if (char === delimiter) {
      pushField();
      i += 1;
      continue;
    }
    if (char === "\r") {
      pushRecord();
      i += content[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    if (char === "\n") {
      pushRecord();
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  if (field !== "" || record.length > 0) {
    pushRecord();
  }

  return records;
}
