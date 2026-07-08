import { describe, expect, it } from "vitest";
import { buildPromptVersionMetadata, hashPromptContent } from "@/prompt/versioning/prompt-version";

describe("hashPromptContent", () => {
  it("is deterministic for identical input", () => {
    expect(hashPromptContent("abc")).toBe(hashPromptContent("abc"));
  });

  it("differs for different input", () => {
    expect(hashPromptContent("abc")).not.toBe(hashPromptContent("abd"));
  });

  it("returns a 16-character lowercase hex string", () => {
    expect(hashPromptContent("anything")).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("buildPromptVersionMetadata", () => {
  it("derives contentHash from hashInput, not the other fields", () => {
    const metadata = buildPromptVersionMetadata({
      version: "v1.0",
      author: "system",
      createdAt: "2026-07-08T00:00:00.000Z",
      releaseNotes: "initial",
      hashInput: "crm-extraction:default:v1.0",
    });
    expect(metadata.contentHash).toBe(hashPromptContent("crm-extraction:default:v1.0"));
    expect(metadata.version).toBe("v1.0");
    expect(metadata).not.toHaveProperty("hashInput");
  });
});
