import type { CrmOutputField } from "@/ai/schema/crm-output-schema";
import type { DatasetContext } from "@/ai/context/dataset-context-builder";

export type ExampleCategory =
  | "facebook-leads"
  | "google-ads"
  | "crm-export"
  | "real-estate"
  | "excel"
  | "marketing-agency"
  | "manual-spreadsheet";

export interface FewShotExample {
  readonly category: ExampleCategory;
  readonly description: string;
  readonly inputHeaders: readonly string[];
  readonly inputRow: Readonly<Record<string, string | null>>;
  readonly expectedOutput: Readonly<Record<CrmOutputField, string | null>>;
}

function emptyOutput(
  overrides: Partial<Record<CrmOutputField, string | null>>,
): Record<CrmOutputField, string | null> {
  return {
    created_at: null,
    name: null,
    email: null,
    country_code: null,
    mobile_without_country_code: null,
    company: null,
    city: null,
    state: null,
    country: null,
    lead_owner: null,
    crm_status: null,
    crm_note: null,
    data_source: null,
    possession_time: null,
    description: null,
    ...overrides,
  };
}

/** One representative example per named category — real headers a user would plausibly export. */
export const FEW_SHOT_EXAMPLES: readonly FewShotExample[] = [
  {
    category: "facebook-leads",
    description: "A Facebook Lead Ads CSV export.",
    inputHeaders: ["full_name", "email", "phone_number", "created_time", "campaign_name"],
    inputRow: {
      full_name: "Priya Sharma",
      email: "priya.sharma@example.com",
      phone_number: "+91 98765 43210",
      created_time: "2026-02-10T09:15:00Z",
      campaign_name: "Sarjapur Plots - Feb Campaign",
    },
    expectedOutput: emptyOutput({
      created_at: "2026-02-10T09:15:00Z",
      name: "Priya Sharma",
      email: "priya.sharma@example.com",
      country_code: "+91",
      mobile_without_country_code: "9876543210",
      data_source: "sarjapur_plots",
    }),
  },
  {
    category: "google-ads",
    description: "A Google Ads lead form download.",
    inputHeaders: ["Name", "Email", "Phone", "Submission time", "Form"],
    inputRow: {
      Name: "Arjun Mehta",
      Email: "arjun.mehta@example.com",
      Phone: "9998887770",
      "Submission time": "2026/03/01",
      Form: "Meridian Tower Enquiry",
    },
    expectedOutput: emptyOutput({
      created_at: "2026-03-01",
      name: "Arjun Mehta",
      email: "arjun.mehta@example.com",
      mobile_without_country_code: "9998887770",
      data_source: "meridian_tower",
    }),
  },
  {
    category: "crm-export",
    description: "An export from another CRM system with its own status vocabulary.",
    inputHeaders: ["Contact Name", "Mail ID", "Mobile", "Owner", "Status", "Notes"],
    inputRow: {
      "Contact Name": "Kavya Reddy",
      "Mail ID": "kavya.r@example.com",
      Mobile: "+91-9876500000",
      Owner: "Rahul",
      Status: "Follow up needed",
      Notes: "Interested, call back next week",
    },
    expectedOutput: emptyOutput({
      name: "Kavya Reddy",
      email: "kavya.r@example.com",
      country_code: "+91",
      mobile_without_country_code: "9876500000",
      lead_owner: "Rahul",
      crm_status: "GOOD_LEAD_FOLLOW_UP",
      crm_note: "Interested, call back next week",
    }),
  },
  {
    category: "real-estate",
    description: "A real-estate CRM export with a possession-time field.",
    inputHeaders: ["Customer", "Email Address", "Contact Number", "Project", "Possession", "City"],
    inputRow: {
      Customer: "Suresh Nair",
      "Email Address": "suresh.nair@example.com",
      "Contact Number": "9123456780",
      Project: "Eden Park Phase 2",
      Possession: "Ready to move",
      City: "Bengaluru",
    },
    expectedOutput: emptyOutput({
      name: "Suresh Nair",
      email: "suresh.nair@example.com",
      mobile_without_country_code: "9123456780",
      city: "Bengaluru",
      data_source: "eden_park",
      possession_time: "Ready to move",
    }),
  },
  {
    category: "excel",
    description: "A manually formatted Excel export with inconsistent casing.",
    inputHeaders: ["NAME", "EMAIL", "PHONE NO", "STATE", "COUNTRY"],
    inputRow: {
      NAME: "ANITA DESAI",
      EMAIL: "ANITA.DESAI@EXAMPLE.COM",
      "PHONE NO": "9812345670",
      STATE: "Maharashtra",
      COUNTRY: "India",
    },
    expectedOutput: emptyOutput({
      name: "ANITA DESAI",
      email: "anita.desai@example.com",
      mobile_without_country_code: "9812345670",
      state: "Maharashtra",
      country: "India",
    }),
  },
  {
    category: "marketing-agency",
    description: "A spreadsheet from a marketing agency running multiple projects.",
    inputHeaders: ["Lead", "Reach Out At", "Company", "Source Campaign", "Remarks"],
    inputRow: {
      Lead: "Farhan Ali",
      "Reach Out At": "farhan.ali@example.com / 9001122334",
      Company: "Ali Traders",
      "Source Campaign": "Leads on Demand - March",
      Remarks: "Sale done, moving to onboarding",
    },
    expectedOutput: emptyOutput({
      name: "Farhan Ali",
      email: "farhan.ali@example.com",
      mobile_without_country_code: "9001122334",
      company: "Ali Traders",
      data_source: "leads_on_demand",
      crm_status: "SALE_DONE",
      crm_note: "Sale done, moving to onboarding",
    }),
  },
  {
    category: "manual-spreadsheet",
    description: "A hand-maintained spreadsheet with minimal, ambiguous headers.",
    inputHeaders: ["Info"],
    inputRow: {
      Info: "Deepa Iyer, deepa.iyer@example.com, no phone provided",
    },
    expectedOutput: emptyOutput({
      name: "Deepa Iyer",
      email: "deepa.iyer@example.com",
    }),
  },
];

const CATEGORY_HEADER_HINTS: Readonly<Record<ExampleCategory, readonly string[]>> = {
  "facebook-leads": ["full_name", "campaign_name", "created_time"],
  "google-ads": ["submission time", "form"],
  "crm-export": ["owner", "status", "mail id"],
  "real-estate": ["possession", "project"],
  excel: [],
  "marketing-agency": ["remarks", "source campaign"],
  "manual-spreadsheet": [],
};

/**
 * Deterministic, not AI-based: scores each example by how many of its own
 * category hint-words loosely appear (case-insensitive substring) in the
 * dataset's actual headers, and returns the top matches. Falls back to the
 * first `limit` examples if nothing scores above zero, so the prompt always
 * has at least some few-shot guidance.
 */
export function selectExamples(
  context: DatasetContext,
  limit = 2,
  examples: readonly FewShotExample[] = FEW_SHOT_EXAMPLES,
): readonly FewShotExample[] {
  const lowerHeaders = context.headers.map((header) => header.toLowerCase());

  const scored = examples
    .map((example) => {
      const hints = CATEGORY_HEADER_HINTS[example.category];
      const score = hints.filter((hint) =>
        lowerHeaders.some((header) => header.includes(hint)),
      ).length;
      return { example, score };
    })
    .sort((a, b) => b.score - a.score);

  const withPositiveScore = scored.filter((entry) => entry.score > 0);
  const chosen = withPositiveScore.length > 0 ? withPositiveScore : scored;

  return chosen.slice(0, limit).map((entry) => entry.example);
}
