import type { PromptTemplate } from "@/prompt/templates/template-types";

export const CRM_EXTRACTION_TEMPLATE: PromptTemplate = {
  id: "crm-extraction",
  description: "Maps arbitrary CSV rows onto the 15-field CRM schema.",
  systemSections: ["identity", "mission", "business_rules"],
  userSections: [
    "dataset_context",
    "examples",
    "negative_examples",
    "output_schema",
    "current_batch",
  ],
};
