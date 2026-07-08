import { buildOutputSchema, buildOutputSchemaDescription } from "@/prompt/schema/schema-builder";

export function buildOutputSchemaSection(supportsJsonMode: boolean, version?: string): string {
  const schema = buildOutputSchema(version);
  return ["# Output Schema", buildOutputSchemaDescription(schema, supportsJsonMode)].join("\n");
}
