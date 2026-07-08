import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEMPLATE_REGISTRY,
  TemplateRegistry,
  TemplateRegistryError,
} from "@/prompt/templates/template-registry";
import { CRM_EXTRACTION_TEMPLATE } from "@/prompt/templates/crm-extraction-template";

describe("DEFAULT_TEMPLATE_REGISTRY", () => {
  it("has the crm-extraction template pre-registered", () => {
    expect(DEFAULT_TEMPLATE_REGISTRY.get("crm-extraction")).toEqual(CRM_EXTRACTION_TEMPLATE);
  });
});

describe("CRM_EXTRACTION_TEMPLATE", () => {
  it("ends its user sections with current_batch", () => {
    const sections = CRM_EXTRACTION_TEMPLATE.userSections;
    expect(sections[sections.length - 1]).toBe("current_batch");
  });
});

describe("TemplateRegistry", () => {
  it("returns undefined for get() on an unknown id", () => {
    expect(new TemplateRegistry().get("nope")).toBeUndefined();
  });

  it("require() throws TemplateRegistryError for an unknown id", () => {
    expect(() => new TemplateRegistry().require("nope")).toThrow(TemplateRegistryError);
  });

  it("require() returns the template for a known id", () => {
    const registry = new TemplateRegistry();
    registry.register(CRM_EXTRACTION_TEMPLATE);
    expect(registry.require("crm-extraction")).toEqual(CRM_EXTRACTION_TEMPLATE);
  });

  it("list() returns every registered template", () => {
    const registry = new TemplateRegistry();
    registry.register(CRM_EXTRACTION_TEMPLATE);
    expect(registry.list()).toHaveLength(1);
  });
});
