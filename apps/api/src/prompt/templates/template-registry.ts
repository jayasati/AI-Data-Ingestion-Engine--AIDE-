import { CRM_EXTRACTION_TEMPLATE } from "@/prompt/templates/crm-extraction-template";
import type { PromptTemplate } from "@/prompt/templates/template-types";

export class TemplateRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateRegistryError";
  }
}

export class TemplateRegistry {
  private readonly templates = new Map<string, PromptTemplate>();

  register(template: PromptTemplate): void {
    this.templates.set(template.id, template);
  }

  get(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  require(id: string): PromptTemplate {
    const template = this.templates.get(id);
    if (!template) {
      throw new TemplateRegistryError(`Unknown prompt template id "${id}".`);
    }
    return template;
  }

  list(): readonly PromptTemplate[] {
    return [...this.templates.values()];
  }
}

export const DEFAULT_TEMPLATE_REGISTRY = new TemplateRegistry();
DEFAULT_TEMPLATE_REGISTRY.register(CRM_EXTRACTION_TEMPLATE);
