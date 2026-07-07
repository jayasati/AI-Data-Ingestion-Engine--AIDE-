/** Client-declared metadata accompanying a CSV upload. */
export interface UploadRequest {
  fileName: string;
  /** Bytes as reported by the client; the server re-validates the real size. */
  fileSize: number;
  mimeType: string;
}

export interface UploadResponse {
  /** Server-assigned id used by subsequent /preview and /import calls. */
  uploadId: string;
  fileName: string;
  receivedAt: string;
  status: "accepted";
}
