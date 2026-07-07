// Zero-width space, zero-width non-joiner, zero-width joiner, and the UTF-8
// BOM re-encoded as a character. Built from numeric code points (not literal
// glyphs or \u escapes in a regex literal) so the source file cannot end up
// silently containing an actual invisible character.
const ZERO_WIDTH_AND_BOM_CODE_POINTS = [0x200b, 0x200c, 0x200d, 0xfeff];
const ZERO_WIDTH_AND_BOM = new RegExp(
  `[${ZERO_WIDTH_AND_BOM_CODE_POINTS.map((codePoint) => String.fromCharCode(codePoint)).join("")}]`,
  "g",
);
// eslint-disable-next-line no-control-regex -- intentionally stripping C0 control chars, excluding \t \n \r
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

export interface UnicodeNormalizationResult {
  readonly value: string;
  readonly changed: boolean;
}

/**
 * "Normalize encoding" at the structural layer: composed-form Unicode (NFC),
 * no BOM/zero-width characters, no stray control characters. Byte-level
 * encoding detection (UTF-8/Windows-1252/...) happens before content ever
 * reaches the pipeline as a JS string — see UploadContext.
 */
export function normalizeUnicode(value: string): UnicodeNormalizationResult {
  const normalized = value
    .normalize("NFC")
    .replace(ZERO_WIDTH_AND_BOM, "")
    .replace(CONTROL_CHARS, "");
  return { value: normalized, changed: normalized !== value };
}
