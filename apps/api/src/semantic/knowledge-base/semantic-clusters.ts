import type { SemanticFieldId } from "@/semantic/types";

/**
 * One semantic cluster per target field: a label, a short description, and
 * the set of human-written header spellings known to mean the same thing.
 * This is the "semantic dictionary" the architecture calls for instead of
 * scattering alias strings across services — adding a new synonym is a
 * one-line data change here, not a code change anywhere else.
 */
export interface SemanticCluster {
  readonly fieldId: SemanticFieldId;
  readonly label: string;
  readonly description: string;
  readonly aliases: readonly string[];
}

export const SEMANTIC_CLUSTERS: readonly SemanticCluster[] = [
  {
    fieldId: "name",
    label: "Name",
    description: "The lead's full name.",
    aliases: [
      "name",
      "full name",
      "customer name",
      "customer",
      "client",
      "client name",
      "lead",
      "lead name",
      "prospect",
      "prospect name",
      "buyer",
      "buyer name",
      "contact name",
      "contact person",
      "applicant name",
      "person name",
    ],
  },
  {
    fieldId: "email",
    label: "Email",
    description: "The lead's email address.",
    aliases: [
      "email",
      "email address",
      "e-mail",
      "mail",
      "mail id",
      "email id",
      "primary email",
      "contact email",
      "work email",
    ],
  },
  {
    fieldId: "phone",
    label: "Phone",
    description: "The lead's phone number.",
    aliases: [
      "phone",
      "phone number",
      "mobile",
      "mobile number",
      "cell",
      "cell number",
      "contact number",
      "contact no",
      "phone no",
      "whatsapp number",
      "telephone",
    ],
  },
  {
    fieldId: "company",
    label: "Company",
    description: "The lead's company or organization.",
    aliases: [
      "company",
      "company name",
      "organization",
      "organisation",
      "employer",
      "business name",
      "firm",
      "firm name",
    ],
  },
  {
    fieldId: "city",
    label: "City",
    description: "The lead's city.",
    aliases: ["city", "town", "location city"],
  },
  {
    fieldId: "state",
    label: "State",
    description: "The lead's state or province.",
    aliases: ["state", "province", "region"],
  },
  {
    fieldId: "country",
    label: "Country",
    description: "The lead's country.",
    aliases: ["country", "nation"],
  },
  {
    fieldId: "lead_owner",
    label: "Lead Owner",
    description: "The salesperson or agent assigned to this lead.",
    aliases: [
      "lead owner",
      "owner",
      "assigned to",
      "sales owner",
      "sales rep",
      "account owner",
      "agent",
      "assignee",
    ],
  },
  {
    fieldId: "crm_status",
    label: "CRM Status",
    description: "The lead's current status in the sales pipeline.",
    aliases: ["status", "lead status", "crm status", "stage", "deal stage", "pipeline stage"],
  },
  {
    fieldId: "crm_note",
    label: "Notes",
    description: "Free-text remarks about the lead.",
    aliases: ["notes", "note", "remarks", "comments", "additional notes"],
  },
  {
    fieldId: "data_source",
    label: "Source",
    description: "Where this lead originated.",
    aliases: [
      "source",
      "lead source",
      "data source",
      "campaign",
      "campaign name",
      "referral source",
      "channel",
    ],
  },
  {
    fieldId: "possession_time",
    label: "Possession Time",
    description: "Real-estate possession/handover timeline.",
    aliases: ["possession", "possession time", "possession date", "handover date"],
  },
  {
    fieldId: "description",
    label: "Description",
    description: "General free-text description of the lead or inquiry.",
    aliases: ["description", "details", "inquiry details", "message", "requirement"],
  },
  {
    fieldId: "created_at",
    label: "Created At",
    description: "When the lead record was created.",
    aliases: [
      "created at",
      "created on",
      "date created",
      "submission time",
      "submitted at",
      "lead date",
      "entry date",
      "timestamp",
    ],
  },
];
