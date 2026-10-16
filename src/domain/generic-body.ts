import { z } from "zod";
const text = z.string().trim().min(1);
export const GENERIC_BODY_SCHEMAS = {
  Concept: z.object({ definition: text }).passthrough(),
  Principle: z.object({ directive: text }).passthrough(),
  Rule: z.object({ trigger: text, rule_statement: text, machine_evaluable: z.boolean() }).passthrough(),
  ValueSignal: z.object({ observed_condition: text, requested_solution_candidates: z.array(z.string()).optional() }).passthrough(),
  BehaviorStatement: z.object({ condition: text, observable_result: text, operating_constraints: z.array(z.string()).optional() }).passthrough(),
  OpenQuestion: z.object({ question: text, why_it_matters: text }).passthrough(),
  Assumption: z.object({ statement: text, basis: text }).passthrough(),
} as const;
export function validateGenericBody(type: string, body: unknown) {
  const schema = GENERIC_BODY_SCHEMAS[type as keyof typeof GENERIC_BODY_SCHEMAS];
  if (!schema) throw new Error("DEDICATED_OPERATION_REQUIRED: this type does not have an approved generic body contract");
  return schema.parse(body);
}