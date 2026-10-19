import { z } from "zod";
const CONFIDENCE_KEYS = [
  "intent_alignment",
  "simulation_performance",
  "adversarial_results",
  "security_privacy_evidence",
  "accessibility_reliability",
  "capability_pattern_conformance",
  "reversibility_rollback",
  "impact_assessment",
  "shadow_results",
  "data_quality_lineage",
] as const;
const DIM = z.object({
  value: z.number().min(0).max(1),
  evidence_refs: z.array(z.string().uuid()).max(20).default([]),
});
export const EvalInput = z.object({
  object_id: z.string().uuid(),
  action: z.string().trim().min(1).max(120),
  dimensions: z
    .record(DIM)
    .default({})
    .refine(
      (d) =>
        Object.keys(d).every((key) =>
          CONFIDENCE_KEYS.includes(key as (typeof CONFIDENCE_KEYS)[number]),
        ),
      "Unknown confidence dimension",
    ),
  owner_confidence: z.number().min(0).max(1).optional(),
  content_text: z.string().max(4000).optional(),
  flags: z.record(z.boolean()).default({}),
  agent: z.boolean().default(true),
  risk: z
    .object({
      sensitivity: z
        .enum(["public", "internal", "confidential", "restricted", "prohibited"])
        .optional(),
      autonomy: z.number().min(0).max(1).default(0.5),
      reversibility: z.enum(["trivial", "assisted", "difficult", "impossible"]).default("assisted"),
      exposure: z
        .enum(["internal_only", "limited_population", "full_population", "external_parties"])
        .default("internal_only"),
      novelty: z
        .enum(["established_pattern", "adapted_pattern", "novel"])
        .default("established_pattern"),
    })
    .default({}),
});

export type EvaluationInput = z.infer<typeof EvalInput>;
