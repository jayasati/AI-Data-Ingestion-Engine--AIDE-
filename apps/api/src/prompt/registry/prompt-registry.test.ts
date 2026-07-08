import { describe, expect, it } from "vitest";
import { PromptRegistry, PromptRegistryError } from "@/prompt/registry/prompt-registry";
import type { PromptVersionMetadata } from "@/prompt/versioning/prompt-version";

function version(
  version: string,
  overrides: Partial<PromptVersionMetadata> = {},
): PromptVersionMetadata {
  return {
    version,
    author: "system",
    createdAt: "2026-07-08T00:00:00.000Z",
    releaseNotes: "initial",
    contentHash: "0000000000000000",
    ...overrides,
  };
}

describe("PromptRegistry", () => {
  it("registers and retrieves an entry", () => {
    const registry = new PromptRegistry();
    registry.register({
      id: "crm-extraction",
      category: "crm-extraction",
      description: "CRM lead extraction",
      versions: [version("v1.0")],
      currentVersion: "v1.0",
    });
    expect(registry.get("crm-extraction")?.currentVersion).toBe("v1.0");
  });

  it("rejects registering an entry whose currentVersion isn't in its own versions", () => {
    const registry = new PromptRegistry();
    expect(() =>
      registry.register({
        id: "crm-extraction",
        category: "crm-extraction",
        description: "x",
        versions: [version("v1.0")],
        currentVersion: "v2.0",
      }),
    ).toThrow(PromptRegistryError);
  });

  it("registerVersion appends a new version and promotes it by default", () => {
    const registry = new PromptRegistry();
    registry.register({
      id: "crm-extraction",
      category: "crm-extraction",
      description: "x",
      versions: [version("v1.0")],
      currentVersion: "v1.0",
    });
    registry.registerVersion("crm-extraction", version("v1.1"));
    expect(registry.get("crm-extraction")?.currentVersion).toBe("v1.1");
    expect(registry.get("crm-extraction")?.versions.map((v) => v.version)).toEqual([
      "v1.0",
      "v1.1",
    ]);
  });

  it("registerVersion can add a version without promoting it", () => {
    const registry = new PromptRegistry();
    registry.register({
      id: "crm-extraction",
      category: "crm-extraction",
      description: "x",
      versions: [version("v1.0")],
      currentVersion: "v1.0",
    });
    registry.registerVersion("crm-extraction", version("v1.1"), false);
    expect(registry.get("crm-extraction")?.currentVersion).toBe("v1.0");
  });

  it("rejects a duplicate version", () => {
    const registry = new PromptRegistry();
    registry.register({
      id: "crm-extraction",
      category: "crm-extraction",
      description: "x",
      versions: [version("v1.0")],
      currentVersion: "v1.0",
    });
    expect(() => registry.registerVersion("crm-extraction", version("v1.0"))).toThrow(
      PromptRegistryError,
    );
  });

  it("rollback restores a previous currentVersion without losing history", () => {
    const registry = new PromptRegistry();
    registry.register({
      id: "crm-extraction",
      category: "crm-extraction",
      description: "x",
      versions: [version("v1.0")],
      currentVersion: "v1.0",
    });
    registry.registerVersion("crm-extraction", version("v1.1"));
    registry.rollback("crm-extraction", "v1.0");
    expect(registry.get("crm-extraction")?.currentVersion).toBe("v1.0");
    expect(registry.get("crm-extraction")?.versions).toHaveLength(2);
  });

  it("rollback to an unknown version throws", () => {
    const registry = new PromptRegistry();
    registry.register({
      id: "crm-extraction",
      category: "crm-extraction",
      description: "x",
      versions: [version("v1.0")],
      currentVersion: "v1.0",
    });
    expect(() => registry.rollback("crm-extraction", "v9.9")).toThrow(PromptRegistryError);
  });

  it("getVersion defaults to currentVersion when no version is specified", () => {
    const registry = new PromptRegistry();
    registry.register({
      id: "crm-extraction",
      category: "crm-extraction",
      description: "x",
      versions: [version("v1.0"), version("v1.1")],
      currentVersion: "v1.1",
    });
    expect(registry.getVersion("crm-extraction")?.version).toBe("v1.1");
    expect(registry.getVersion("crm-extraction", "v1.0")?.version).toBe("v1.0");
  });

  it("listByCategory filters correctly", () => {
    const registry = new PromptRegistry();
    registry.register({
      id: "crm-extraction",
      category: "crm-extraction",
      description: "x",
      versions: [version("v1.0")],
      currentVersion: "v1.0",
    });
    expect(registry.listByCategory("crm-extraction")).toHaveLength(1);
    expect(registry.listByCategory("ocr")).toHaveLength(0);
  });

  it("recordUsage increments executionCount and tracks lastUsedAt", () => {
    const registry = new PromptRegistry();
    registry.recordUsage("crm-extraction", "v1.0", "2026-07-08T00:00:00.000Z");
    const second = registry.recordUsage("crm-extraction", "v1.0", "2026-07-08T01:00:00.000Z");
    expect(second.executionCount).toBe(2);
    expect(second.lastUsedAt).toBe("2026-07-08T01:00:00.000Z");
    expect(registry.usageFor("crm-extraction", "v1.0")).toEqual(second);
  });

  it("operations against an unknown id throw PromptRegistryError", () => {
    const registry = new PromptRegistry();
    expect(() => registry.registerVersion("unknown", version("v1.0"))).toThrow(PromptRegistryError);
    expect(() => registry.rollback("unknown", "v1.0")).toThrow(PromptRegistryError);
    expect(registry.get("unknown")).toBeUndefined();
    expect(registry.getVersion("unknown")).toBeUndefined();
  });
});
