/**
 * Zod schemas for the universal envelope (Part 4.1), ConfidenceBundle (4.1.1),
 * PermissionSpec and the Phase 1 write operations (Section 19).
 * Type-specific bodies for the depth-priority types are added slice by slice.
 */
import { z } from "zod";

export const ActorSchema = z.object({
  kind: z.enum(["human", "agent", "system"]),
  id: z.string().min(1),
  authority_used: z.enum([
    "observe",
    "recommend",
    "act_with_confirmation",
    "act_bounded",
    "autonomous_with_exception",
  ]),
});

export const DataClassification = z.enum(["public", "internal", "confidential", "restricted"]); // 'prohibited' is never storable
export const RiskTier = z.enum(["1", "2", "3", "4"]);
export const ConsequenceClass = z.enum([
  "none",
  "reversible",
  "costly_reversible",
  "irreversible",
  "rights_affecting",
  "safety",
  "lifeline",
]);

export const PermissionSpec = z.object({
  roles: z.array(z.enum(["steward", "co_creator", "builder", "member", "compliance"])).default([]),
  attributes: z.record(z.string()).optional(),
  context: z.string().optional(),
  purpose: z.string().min(1),
});

/** P4: every live object carries a machine-evaluable expiration condition and a retirement path. */
export const ExpirationCondition = z.object({
  kind: z.enum([
    "review_date_passes",
    "source_hash_changes",
    "min_use_below_threshold",
    "explicit_event",
  ]),
  params: z.record(z.unknown()).optional(),
});
export const RetirementPath = z.object({
  mode: z.enum(["tombstone", "supersede", "archive_evidence"]),
  successor_hint: z.string().optional(),
});

const evidenceValue = z
  .object({
    value: z.number().min(0).max(1),
    evidence_refs: z.array(z.string().uuid()).default([]),
  })
  .passthrough();
/** Part 4.1.1 — never a single opaque score. `overall` is derived by a published rule (Phase 3). */
export const ConfidenceBundle = z.object({
  intent_alignment: evidenceValue.extend({ method: z.string() }),
  simulation_performance: evidenceValue,
  adversarial_results: evidenceValue,
  security_privacy_evidence: evidenceValue,
  accessibility_reliability: evidenceValue,
  capability_pattern_conformance: evidenceValue,
  reversibility_rollback: evidenceValue,
  impact_assessment: evidenceValue,
  shadow_results: evidenceValue,
  risk_tier: RiskTier,
  owner_confidence: z.object({
    value: z.number().min(0).max(1),
    actor: z.string(),
    rationale: z.string(),
  }),
  data_quality_lineage: evidenceValue,
  model_agent_evaluations: z.array(
    z.object({
      model: z.string(),
      suite: z.string(),
      result: z.string(),
      evidence_refs: z.array(z.string()),
    }),
  ),
  computed_at: z.string(),
  computed_by: z.string(),
});

export const CreateObjectInput = z.object({
  type: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  statement: z.string().trim().min(1).max(4000),
  machine_description: z.string().trim().min(1).max(2000),
  body: z.record(z.unknown()).default({}),
  review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiration_condition: ExpirationCondition,
  retirement_path: RetirementPath,
  risk_tier: RiskTier,
  consequence_class: ConsequenceClass.default("none"),
  permission: PermissionSpec,
  data_classification: DataClassification,
  rationale: z.string().trim().min(1).max(1000),
});
export type CreateObjectInput = z.infer<typeof CreateObjectInput>;

export const ReviseInput = z.object({
  id: z.string().uuid(),
  expected_version: z.number().int().positive(),
  patch: CreateObjectInput.pick({
    title: true,
    statement: true,
    machine_description: true,
    review_date: true,
    risk_tier: true,
    data_classification: true,
  }).partial(),
  rationale: z.string().trim().min(1).max(1000),
});
export const TransitionInput = z.object({
  id: z.string().uuid(),
  expected_version: z.number().int().positive(),
  to_state: z.string().min(1),
  rationale: z.string().trim().min(1).max(1000),
});
export const TombstoneInput = z.object({
  id: z.string().uuid(),
  expected_version: z.number().int().positive(),
  reason: z.string().trim().min(1).max(1000),
});

/** UI-only label alias (Part 2.5). Never a type, state or measure. */
export const LABEL_ALIASES: Record<string, string> = {
  BehaviorStatement: "Behaviour statement (requirement)",
};
