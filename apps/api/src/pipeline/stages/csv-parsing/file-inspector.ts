const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

export interface FileInspectionResult {
  /** Content with a leading byte-order mark stripped, if one was present. */
  readonly content: string;
  readonly hadByteOrderMark: boolean;
  readonly encodingLabel: string;
}

/**
 * First step of CSV Parsing: look at the file before tokenizing it. Today
 * this only strips a leading UTF-8 BOM character (so it never corrupts the
 * first header name) and labels the encoding accordingly. True byte-level
 * encoding detection (UTF-8 vs UTF-16 vs Windows-1252) happens one layer up,
 * wherever raw upload bytes are decoded into the JS string this stage
 * receives — see the ingestion module's encoding-detector for that boundary.
 */
export function inspectFile(rawContent: string, declaredEncoding?: string): FileInspectionResult {
  const hadByteOrderMark = rawContent.startsWith(BYTE_ORDER_MARK);
  const content = hadByteOrderMark ? rawContent.slice(1) : rawContent;
  const encodingLabel = declaredEncoding ?? (hadByteOrderMark ? "UTF-8 (BOM)" : "UTF-8");

  return { content, hadByteOrderMark, encodingLabel };
}
