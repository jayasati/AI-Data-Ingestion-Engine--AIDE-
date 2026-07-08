import { describe, expect, it } from "vitest";
import { AliasRegistry } from "@/semantic/knowledge-base/alias-registry";

describe("AliasRegistry", () => {
  it("seeds static aliases from SEMANTIC_CLUSTERS and normalizes lookup keys", () => {
    const registry = new AliasRegistry();
    expect(registry.has("email_address")).toBe(true);
    expect(registry.lookup("Email Address".toLowerCase())).toEqual([]); // lookup expects a normalized key
    const entries = registry.lookup("email_address");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ fieldId: "email", source: "static" });
  });

  it("registers a custom alias without disturbing static ones", () => {
    const registry = new AliasRegistry([]);
    registry.register("Reach Out At", "phone", "custom");
    const entries = registry.lookup("reach_out_at");
    expect(entries).toEqual([
      { normalizedAlias: "reach_out_at", fieldId: "phone", source: "custom" },
    ]);
  });

  it("de-duplicates a repeated (alias, fieldId) registration", () => {
    const registry = new AliasRegistry([]);
    registry.register("Contact", "phone", "custom");
    registry.register("Contact", "phone", "custom");
    expect(registry.lookup("contact")).toHaveLength(1);
  });

  it("allows the same normalized alias to map to more than one field", () => {
    const registry = new AliasRegistry([]);
    registry.register("Contact", "phone", "custom");
    registry.register("Contact", "email", "custom");
    expect(
      registry
        .lookup("contact")
        .map((entry) => entry.fieldId)
        .sort(),
    ).toEqual(["email", "phone"]);
  });

  it("has() reflects whether any entry exists for a normalized key", () => {
    const registry = new AliasRegistry([]);
    expect(registry.has("owner")).toBe(false);
    registry.register("Owner", "lead_owner");
    expect(registry.has("owner")).toBe(true);
  });
});
