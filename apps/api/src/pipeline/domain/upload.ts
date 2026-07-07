/**
 * Raw material handed to the Upload stage. Deliberately framework-free — a future
 * HTTP module decodes a multipart request into this shape; the pipeline never
 * sees Express types. `content` is already decoded to a JS string: byte-level
 * encoding detection (UTF-8/BOM/Windows-1252/...) belongs to the transport layer
 * that produces this value, not to the pipeline itself. `detectedEncoding`
 * carries that transport layer's finding (e.g. "UTF-16LE") through so CSV
 * Parsing can report it without re-detecting from an already-decoded string.
 */
export interface RawUploadInput {
  readonly fileName: string;
  readonly mimeType: string;
  readonly declaredSizeBytes: number;
  readonly content: string;
  readonly detectedEncoding?: string;
}

/** Verified, pipeline-owned representation of an uploaded file. */
export interface UploadedFile {
  readonly uploadId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly content: string;
  readonly detectedEncoding?: string;
  readonly receivedAt: string;
}

/** Output of the Upload stage — the unit every later stage traces back to. */
export interface UploadContext {
  readonly uploadedFile: UploadedFile;
}
