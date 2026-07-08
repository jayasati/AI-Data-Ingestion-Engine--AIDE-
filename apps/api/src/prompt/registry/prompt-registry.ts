import type { PromptVersionMetadata } from "@/prompt/versioning/prompt-version";

/**
 * Extraction target this prompt serves. Only "crm-extraction" has a real
 * implementation this volume — the rest exist so the registry's shape never
 * has to change when those volumes land, per the spec's explicit "Future
 * OCR/PDF/Excel/Classification" requirement.
 */
export const PROMPT_CATEGORIES = [
  "crm-extraction",
  "ocr",
  "pdf",
  "excel",
  "classification",
] as const;

export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

export interface PromptRegistryEntry {
  readonly id: string;
  readonly category: PromptCategory;
  readonly description: string;
  /** History, oldest first. Never mutated in place — `registerVersion` replaces the array. */
  readonly versions: readonly PromptVersionMetadata[];
  readonly currentVersion: string;
}

export interface PromptUsageStats {
  readonly id: string;
  readonly version: string;
  readonly executionCount: number;
  readonly lastUsedAt: string | null;
}

export class PromptRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptRegistryError";
  }
}

/**
 * Stores, versions, categorizes, and retrieves prompts, and tracks how often
 * each version actually runs. This is the "prompts are first-class software
 * artifacts" claim made concrete: a prompt is a registry entry with a
 * version history and usage counters, not a string constant.
 */
export class PromptRegistry {
  private readonly entries = new Map<string, PromptRegistryEntry>();
  private readonly usage = new Map<string, PromptUsageStats>();

  register(entry: PromptRegistryEntry): void {
    if (!entry.versions.some((v) => v.version === entry.currentVersion)) {
      throw new PromptRegistryError(
        `Cannot register "${entry.id}": currentVersion "${entry.currentVersion}" is not among its versions.`,
      );
    }
    this.entries.set(entry.id, entry);
  }

  /**
   * Appends a new version to an already-registered prompt — the "future
   * prompt migration" path. Does not retroactively change `currentVersion`
   * unless `makeCurrent` is true, so a new version can be registered and
   * benchmarked before being promoted.
   */
  registerVersion(id: string, version: PromptVersionMetadata, makeCurrent = true): void {
    const entry = this.require(id);
    if (entry.versions.some((v) => v.version === version.version)) {
      throw new PromptRegistryError(`Prompt "${id}" already has a version "${version.version}".`);
    }
    this.entries.set(id, {
      ...entry,
      versions: [...entry.versions, version],
      currentVersion: makeCurrent ? version.version : entry.currentVersion,
    });
  }

  /** Rolls `currentVersion` back to an already-known version — never deletes history. */
  rollback(id: string, toVersion: string): void {
    const entry = this.require(id);
    if (!entry.versions.some((v) => v.version === toVersion)) {
      throw new PromptRegistryError(
        `Prompt "${id}" has no version "${toVersion}" to roll back to.`,
      );
    }
    this.entries.set(id, { ...entry, currentVersion: toVersion });
  }

  get(id: string): PromptRegistryEntry | undefined {
    return this.entries.get(id);
  }

  getVersion(id: string, version?: string): PromptVersionMetadata | undefined {
    const entry = this.entries.get(id);
    if (!entry) {
      return undefined;
    }
    const target = version ?? entry.currentVersion;
    return entry.versions.find((v) => v.version === target);
  }

  list(): readonly PromptRegistryEntry[] {
    return [...this.entries.values()];
  }

  listByCategory(category: PromptCategory): readonly PromptRegistryEntry[] {
    return this.list().filter((entry) => entry.category === category);
  }

  recordUsage(
    id: string,
    version: string,
    at: string = new Date().toISOString(),
  ): PromptUsageStats {
    const key = usageKey(id, version);
    const previous = this.usage.get(key);
    const next: PromptUsageStats = {
      id,
      version,
      executionCount: (previous?.executionCount ?? 0) + 1,
      lastUsedAt: at,
    };
    this.usage.set(key, next);
    return next;
  }

  usageFor(id: string, version: string): PromptUsageStats | undefined {
    return this.usage.get(usageKey(id, version));
  }

  private require(id: string): PromptRegistryEntry {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new PromptRegistryError(`Unknown prompt id "${id}".`);
    }
    return entry;
  }
}

function usageKey(id: string, version: string): string {
  return `${id}@${version}`;
}
