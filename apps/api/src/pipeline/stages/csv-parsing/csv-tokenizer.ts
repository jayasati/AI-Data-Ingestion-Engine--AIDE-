/**
 * RFC 4180–style tokenizer: quote-aware, handles delimiters and newlines
 * embedded in quoted fields, and doubled quotes (`""`) as an escaped quote.
 * Operates on the whole content at once (not line-by-line) specifically so an
 * embedded newline inside a quoted field is never mistaken for a row break.
 *
 * Implemented as a generator so a record is yielded the moment it completes,
 * rather than requiring the whole file to be tokenized before anything can
 * be read. `tokenizeCsv` collects the generator into an array for the
 * current (in-memory) pipeline; a future streaming upload path can consume
 * `iterateCsvRecords` directly, one record at a time, without this file
 * changing. Today the content itself is still a fully materialized string —
 * see RawUploadInput's docs for that scope boundary.
 */
export function* iterateCsvRecords(content: string, delimiter: string): Generator<string[]> {
  let field = "";
  let record: string[] = [];
  let insideQuotes = false;
  let i = 0;
  const length = content.length;

  const takeField = (): void => {
    record.push(field);
    field = "";
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

    if (char === '"' && /^[ \t]*$/.test(field)) {
      // Real-world exports commonly write ", "value, with a comma" ," with a
      // space after the delimiter before the opening quote. Strict RFC 4180
      // requires the quote to be the field's first character; being lenient
      // here (discarding only leading horizontal whitespace) matches how
      // Excel and most spreadsheet tools actually read such files, and
      // avoids silently splitting a quoted value's embedded delimiter.
      insideQuotes = true;
      field = "";
      i += 1;
      continue;
    }
    if (char === delimiter) {
      takeField();
      i += 1;
      continue;
    }
    if (char === "\r" || char === "\n") {
      takeField();
      yield record;
      record = [];
      i += char === "\r" && content[i + 1] === "\n" ? 2 : 1;
      continue;
    }

    field += char;
    i += 1;
  }

  if (field !== "" || record.length > 0) {
    takeField();
    yield record;
  }
}

export function tokenizeCsv(content: string, delimiter: string): string[][] {
  return [...iterateCsvRecords(content, delimiter)];
}
