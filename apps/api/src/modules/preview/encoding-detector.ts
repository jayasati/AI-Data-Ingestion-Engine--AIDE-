const UTF16_LE_BOM = Buffer.from([0xff, 0xfe]);
const UTF16_BE_BOM = Buffer.from([0xfe, 0xff]);
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

export interface DecodedUpload {
  readonly content: string;
  readonly detectedEncoding: string;
}

/**
 * The byte-level encoding boundary Volume 2 deferred: this is the one place
 * raw upload bytes become the JS string the pipeline works with from here on.
 * BOM-sniffing is the standard, deterministic way to tell UTF-8 from UTF-16
 * without a full charset-detection library — good enough for CSV exports,
 * which almost always carry a BOM when they are not plain UTF-8.
 */
export function decodeUploadBuffer(buffer: Buffer): DecodedUpload {
  if (startsWith(buffer, UTF16_LE_BOM)) {
    return { content: buffer.subarray(2).toString("utf16le"), detectedEncoding: "UTF-16LE" };
  }
  if (startsWith(buffer, UTF16_BE_BOM)) {
    return {
      content: swapBytePairs(buffer.subarray(2)).toString("utf16le"),
      detectedEncoding: "UTF-16BE",
    };
  }
  if (startsWith(buffer, UTF8_BOM)) {
    return { content: buffer.subarray(3).toString("utf8"), detectedEncoding: "UTF-8 (BOM)" };
  }
  return { content: buffer.toString("utf8"), detectedEncoding: "UTF-8" };
}

function startsWith(buffer: Buffer, prefix: Buffer): boolean {
  return buffer.length >= prefix.length && buffer.subarray(0, prefix.length).equals(prefix);
}

/** Node has no native "utf16be" decoder; swapping byte pairs lets utf16le do the work. */
function swapBytePairs(buffer: Buffer): Buffer {
  const swapped = Buffer.from(buffer);
  for (let i = 0; i + 1 < swapped.length; i += 2) {
    const high = swapped[i];
    swapped[i] = swapped[i + 1];
    swapped[i + 1] = high;
  }
  return swapped;
}
