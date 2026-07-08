import { headerRule } from "@/semantic/rules/header-rule";
import { knowledgeRule } from "@/semantic/rules/knowledge-rule";
import { regexRule } from "@/semantic/rules/regex-rule";
import { patternRule } from "@/semantic/rules/pattern-rule";
import { statisticalRule } from "@/semantic/rules/statistical-rule";
import { historicalRule } from "@/semantic/rules/historical-rule";

export type {
  RuleCategory,
  RuleContext,
  RuleSignal,
  SemanticRule,
} from "@/semantic/rules/rule-types";
export { headerRule } from "@/semantic/rules/header-rule";
export { knowledgeRule } from "@/semantic/rules/knowledge-rule";
export { regexRule } from "@/semantic/rules/regex-rule";
export { patternRule } from "@/semantic/rules/pattern-rule";
export { statisticalRule } from "@/semantic/rules/statistical-rule";
export { historicalRule } from "@/semantic/rules/historical-rule";

/** Registration point for new rules — add here, nowhere else needs to know. */
export const DEFAULT_RULES = [
  headerRule,
  knowledgeRule,
  regexRule,
  patternRule,
  statisticalRule,
  historicalRule,
];
