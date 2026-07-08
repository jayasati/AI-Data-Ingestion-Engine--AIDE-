import {
  selectNegativeExamples,
  type NegativeExample,
} from "@/prompt/examples/negative-example-registry";

export interface NegativeExamplesSectionResult {
  readonly text: string;
  readonly negativeExamplesUsed: readonly string[];
}

export function buildNegativeExamplesSection(limit: number): NegativeExamplesSectionResult {
  const examples = selectNegativeExamples(limit);

  if (examples.length === 0) {
    return { text: "", negativeExamplesUsed: [] };
  }

  const rendered = examples.map(
    (example) =>
      `- WRONG: "${example.sourceField}" -> "${example.incorrectTargetField}". ${example.explanation}`,
  );

  return {
    text: ["# Known Wrong Mappings", "Do not repeat these mistakes:", ...rendered].join("\n"),
    negativeExamplesUsed: examples.map((example: NegativeExample) => example.id),
  };
}
