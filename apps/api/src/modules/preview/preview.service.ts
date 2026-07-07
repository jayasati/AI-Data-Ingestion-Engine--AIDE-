/** Wire shape of the preview stub until the CSV parser produces real previews. */
export interface PreviewStub {
  implemented: false;
  message: string;
}

export interface IPreviewService {
  previewUpload(): PreviewStub;
}

/**
 * Placeholder: the deterministic CSV preview (parse, header analysis, sample rows)
 * lands here in the pipeline phase. Deliberately AI-free by design.
 */
export class PreviewService implements IPreviewService {
  previewUpload(): PreviewStub {
    return {
      implemented: false,
      message:
        "CSV preview is not implemented yet; the parsing engine lands in the pipeline phase.",
    };
  }
}
