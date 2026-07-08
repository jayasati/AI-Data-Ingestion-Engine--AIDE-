import { selectExamples, type FewShotExample } from "@/ai/prompt/example-registry";
import type { DatasetContext } from "@/ai/context/dataset-context-builder";

export interface ExamplesSectionResult {
  readonly text: string;
  readonly examplesUsed: readonly FewShotExample["category"][];
}

/**
 * Delegates selection to Volume 5's `example-registry.ts` (7-category
 * few-shot library, header-hint scoring) rather than duplicating it — this
 * platform's job is compiling and reporting on prompts, not re-implementing
 * an already-correct few-shot selector.
 */
export function buildExamplesSection(
  datasetContext: DatasetContext,
  limit: number,
): ExamplesSectionResult {
  const examples = selectExamples(datasetContext, limit);

  if (examples.length === 0) {
    return {
      text: "# Examples\n(No closely matching examples for this dataset shape.)",
      examplesUsed: [],
    };
  }

  const rendered = examples.map((example, index) =>
    [
      `Example ${index + 1} (${example.category}): ${example.description}`,
      `Input headers: ${example.inputHeaders.join(", ")}`,
      `Input row: ${JSON.stringify(example.inputRow)}`,
      `Expected output fields: ${JSON.stringify(example.expectedOutput)}`,
    ].join("\n"),
  );

  return {
    text: ["# Examples", ...rendered].join("\n\n"),
    examplesUsed: examples.map((example) => example.category),
  };
}
