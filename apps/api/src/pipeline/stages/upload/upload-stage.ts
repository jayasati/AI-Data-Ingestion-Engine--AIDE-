import { randomUUID } from "node:crypto";
import type { PipelineStage, StageExecution } from "@/pipeline/contracts/pipeline-stage";
import type { StageIssue, StageWarning } from "@/pipeline/contracts/stage-result";
import type { PipelineContext } from "@/pipeline/context";
import type { RawUploadInput, UploadContext, UploadedFile } from "@/pipeline/domain/upload";
import { buildStageResult } from "@/pipeline/stages/shared/stage-result-factory";

const STAGE_NAME = "upload";

/**
 * Verifies and wraps a raw upload. Deliberately has no idea how the bytes
 * arrived (multipart, base64, a test harness) — that decoding is the
 * responsibility of whatever produces a `RawUploadInput`.
 */
export class UploadStage implements PipelineStage<RawUploadInput, UploadContext> {
  readonly name = STAGE_NAME;

  async execute(
    input: RawUploadInput,
    context: PipelineContext,
  ): Promise<StageExecution<UploadContext>> {
    const startedAt = new Date();
    const sizeBytes = Buffer.byteLength(input.content, "utf8");
    const issues = verifyRequest(input, sizeBytes, context.configuration.maxFileSizeBytes);

    if (issues.length > 0) {
      return {
        context,
        result: buildStageResult<UploadContext>({
          stageName: STAGE_NAME,
          startedAt,
          metadata: { fileName: input.fileName, declaredSizeBytes: input.declaredSizeBytes },
          errors: issues,
          outcome: "fatal_failure",
          output: null,
        }),
      };
    }

    const uploadedFile: UploadedFile = {
      uploadId: randomUUID(),
      fileName: input.fileName.trim(),
      mimeType: input.mimeType.trim(),
      sizeBytes,
      content: input.content,
      detectedEncoding: input.detectedEncoding,
      receivedAt: new Date().toISOString(),
    };

    const warnings: StageWarning[] = [];
    if (input.declaredSizeBytes !== sizeBytes) {
      warnings.push({
        code: "DECLARED_SIZE_MISMATCH",
        message: "Declared file size does not match the received content length.",
        context: { declaredSizeBytes: input.declaredSizeBytes, actualSizeBytes: sizeBytes },
      });
    }

    const output: UploadContext = { uploadedFile };
    const nextContext = context.mergeStatistics({ uploadSizeBytes: sizeBytes });

    return {
      context: nextContext,
      result: buildStageResult({
        stageName: STAGE_NAME,
        startedAt,
        metadata: {
          uploadId: uploadedFile.uploadId,
          fileName: uploadedFile.fileName,
          sizeBytes: uploadedFile.sizeBytes,
        },
        warnings,
        outcome: warnings.length > 0 ? "warning" : "success",
        output,
      }),
    };
  }
}

function verifyRequest(
  input: RawUploadInput,
  sizeBytes: number,
  maxFileSizeBytes: number,
): StageIssue[] {
  const issues: StageIssue[] = [];

  if (!input.fileName || input.fileName.trim() === "") {
    issues.push({ code: "MISSING_FILE_NAME", message: "fileName is required." });
  }
  if (!input.mimeType || input.mimeType.trim() === "") {
    issues.push({ code: "MISSING_MIME_TYPE", message: "mimeType is required." });
  }
  if (!input.content || input.content.trim() === "") {
    issues.push({ code: "EMPTY_FILE", message: "Uploaded file has no content." });
  }
  if (sizeBytes > maxFileSizeBytes) {
    issues.push({
      code: "FILE_TOO_LARGE",
      message: `File exceeds the maximum allowed size of ${maxFileSizeBytes} bytes.`,
      context: { maxFileSizeBytes, actualSizeBytes: sizeBytes },
    });
  }

  return issues;
}
