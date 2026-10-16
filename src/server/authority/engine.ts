/**
 * THREAD authority and guardrail engine (K3, Layer B Part 6).
 * Pure and deterministic: no I/O, no clock reads (callers pass `now`), no model calls.
 * The same module runs inside server functions and in the tests.
 */
import { classifyContent, type ContentTier } from "@/domain/content-tier";

export const ENGINE_ID = "thread.authority.engine@1.0.0";

// ---------------------------------------------------------------- 6.1 risk tiers
export type Consequence =
  | "none" | "reversible" | "costly_reversible" | "irreversible" | "rights_affecting" | "safety" | "lifeline";
export type Sensitivity = "public" | "internal" | "confidential" | "restricted" | "prohibited";
export type Reversibility = "trivial" | "assisted" | "difficult" | "impossible";
export type Exposure = "internal_only" | "limited_population" | "full_population" | "external_parties";
export type Novelty = "established_pattern" | "adapted_pattern" | "novel";
export type Tier = 1 | 2 | 3 | 4;

export interface RiskInputs {
  consequence: Consequence;
  sensitivity: Sensitivity;
  /** degree of unsupervised action requested, 0 (none) .. 1 (fully unsupervised) */
  autonomy: number;
  reversibility: Reversibility;
  exposure: Exposure;
  novelty: Novelty;
  /** evidence bundle completeness, 0..1 */
  evidence: number;
}
export interface RiskAssessment extends RiskInputs {
  computed_tier: Tier;
  treatment: string;
  reasons: string[];
  computed_at: string;
  computed_by: string;
}

export const TIER_TREATMENT: Record<Tier, string> = {
  1: "Automated checks; Builder accountability; rapid exposure",
  2: "Targeted controls; limited exposure; enhanced observation",
  3: "Consequence-owner confirmation; adversarial evaluation; Shadow evidence; strict rollback",
  4: "Formal assurance; independent human judgment; strict least authority; continuous monitoring",
};

/**
 * Tier is the maximum of the per-input floors (never an average, so one severe input cannot be diluted).
 * DESIGN DECISION: Part 6.1 names the inputs and tier characteristics, not the arithmetic; this mapping is ours.
 */
export function assessRisk(i: RiskInputs, now: string): RiskAssessment {
  const reasons: string[] = [];
  let tier: Tier = 1;
  const raise = (t: Tier, why: string) => {
    if (t > tier) tier = t;
    if (t > 1) reasons.push(`${why} → tier ${t}`);
  };
  raise(({ none: 1, reversible: 1, costly_reversible: 2, irreversible: 3, rights_affecting: 4, safety: 4, lifeline: 4 } as const)[i.consequence], `consequence ${i.consequence}`);
  raise(({ public: 1, internal: 1, confidential: 2, restricted: 3, prohibited: 4 } as const)[i.sensitivity], `sensitivity ${i.sensitivity}`);
  raise(({ trivial: 1, assisted: 2, difficult: 3, impossible: 3 } as const)[i.reversibility], `reversibility ${i.reversibility}`);
  raise(({ internal_only: 1, limited_population: 2, full_population: 3, external_parties: 3 } as const)[i.exposure], `exposure ${i.exposure}`);
  if (i.novelty === "novel") raise(2, "novel pattern");
  if (i.autonomy >= 0.8 && tier >= 3) raise(4, "high autonomy on a high-tier action");
  if (i.evidence < 0.5 && tier >= 2) raise((Math.min(4, tier + 1) as Tier), "thin evidence");
  return { ...i, computed_tier: tier, treatment: TIER_TREATMENT[tier], reasons, computed_at: now, computed_by: ENGINE_ID };
}

/** NON-NEGOTIABLE 6.1: upward override with rationale only; downward override is PROHIBITED. */
export function overrideTier(computed: Tier, requested: Tier, rationale: string): Tier {
  if (requested < computed) throw new Error("RISK_TIER_DOWNWARD_OVERRIDE_PROHIBITED (Part 6.1)");
  if (requested > computed && !rationale.trim()) throw new Error("RATIONALE_REQUIRED: upward override needs a recorded rationale");
  return requested;
}

// ---------------------------------------------------------------- 6.3 confidence rule
export const CONFIDENCE_DIMENSIONS = [
  "intent_alignment", "simulation_performance", "adversarial_results", "security_privacy_evidence",
  "accessibility_reliability", "capability_pattern_conformance", "reversibility_rollback", "impact_assessment",
  "shadow_results", "data_quality_lineage",
] as const;
export type Dimension = (typeof CONFIDENCE_DIMENSIONS)[number];
export interface DimValue { value: number; evidence_refs: string[]; simulated?: boolean }
export type BundleInput = Partial<Record<Dimension, DimValue>> & { owner_confidence?: { value: number } };

/**
 * Published rule cr-1.0.0 (readable, versioned, never learned). Stored as a Rule object in the graph.
 *   1. A dimension with no evidence_refs counts as 0.
 *   2. The tier decides which dimensions are required (below).
 *   3. overall = the MINIMUM over required dimensions (weakest link).
 *   4. band: high >= 0.80, moderate >= 0.50, otherwise low.
 * DESIGN DECISION: Part 6.3 requires a published rule but does not give its content.
 */
export const CONFIDENCE_RULE = {
  version: "cr-1.0.0",
  required: {
    1: ["intent_alignment", "simulation_performance", "capability_pattern_conformance", "reversibility_rollback"],
    2: ["intent_alignment", "simulation_performance", "capability_pattern_conformance", "reversibility_rollback", "security_privacy_evidence", "accessibility_reliability", "data_quality_lineage"],
    3: ["intent_alignment", "simulation_performance", "capability_pattern_conformance", "reversibility_rollback", "security_privacy_evidence", "accessibility_reliability", "data_quality_lineage", "adversarial_results", "shadow_results", "impact_assessment"],
    4: [...CONFIDENCE_DIMENSIONS],
  } as Record<Tier, readonly Dimension[]>,
  bands: { high: 0.8, moderate: 0.5 },
  text: "A dimension without evidence counts as 0. The risk tier selects the required dimensions. Overall = the lowest required dimension. High >= 0.80, moderate >= 0.50, otherwise low. Tier 4 also requires owner confidence >= 0.80.",
} as const;
export type Band = "high" | "moderate" | "low";

export function computeOverall(b: BundleInput, tier: Tier): { overall: number; band: Band; weakest: Dimension | null; explanation: string } {
  let overall = 1;
  let weakest: Dimension | null = null;
  for (const d of CONFIDENCE_RULE.required[tier]) {
    const v = b[d] && b[d]!.evidence_refs.length > 0 ? Math.max(0, Math.min(1, b[d]!.value)) : 0;
    if (v < overall) { overall = v; weakest = d; }
  }
  if (tier === 4) {
    const oc = b.owner_confidence?.value ?? 0;
    if (oc < 0.8 && oc < overall) { overall = oc; weakest = null; }
  }
  overall = Math.round(overall * 1000) / 1000;
  const band: Band = overall >= CONFIDENCE_RULE.bands.high ? "high" : overall >= CONFIDENCE_RULE.bands.moderate ? "moderate" : "low";
  return { overall, band, weakest, explanation: `${CONFIDENCE_RULE.version}: overall ${overall} (${band}); weakest ${weakest ?? "owner_confidence"}` };
}

// ---------------------------------------------------------------- 6.2 authority ladder
export const LADDER = ["observe", "recommend", "act_with_confirmation", "act_bounded", "autonomous_with_exception"] as const;
export type Level = (typeof LADDER)[number];
const rank = (l: Level) => LADDER.indexOf(l);

export interface PromotionEvidence {
  /** only non-simulated evidence counts (Section 5) */
  shadow_or_simulation_score?: { value: number; simulated: boolean };
  unresolved_critical_findings: number;
  consecutive_agreements?: { count: number; simulated: boolean };
  shadow_evidence?: { simulated: boolean };
  rollback_verified?: { simulated: boolean };
  policy_conformance: boolean;
  risk_tier: Tier;
  sustained_production?: { days: number; simulated: boolean };
  discrepancy_rate?: { value: number; simulated: boolean };
  critical_incidents_in_period: number;
  explicit_human_grant_ref?: string | null;
  /** Tier 4 extras (6.2 PROHIBITED clause) */
  independent_human_judgment_ref?: string | null;
  continuous_monitoring?: boolean;
  kill_switch_armed?: boolean;
}
/**
 * Promotion thresholds. DESIGN DECISION, PROVISIONAL: Part 6.2 says "above threshold" without numbers.
 * These are seeded into the `human_oversight` guardrail params so the steward can change them by canon change.
 */
export const PROMOTION_THRESHOLDS = {
  shadow_or_simulation_min: 0.8,
  consecutive_agreements_min: 20,
  sustained_production_days_min: 30,
  discrepancy_rate_max: 0.02,
};
type Thresholds = typeof PROMOTION_THRESHOLDS;

export function evaluatePromotion(current: Level, e: PromotionEvidence, t: Thresholds = PROMOTION_THRESHOLDS): { promote: boolean; to: Level; missing: string[] } {
  const live = <T extends { simulated: boolean }>(x: T | undefined) => (x && !x.simulated ? x : undefined);
  const missing: string[] = [];
  const next = LADDER[rank(current) + 1];
  if (!next) return { promote: false, to: current, missing: ["already at the top of the ladder"] };
  if (next === "recommend") {
    const s = live(e.shadow_or_simulation_score);
    if (!s || s.value < t.shadow_or_simulation_min) missing.push(`non-simulated shadow or simulation evidence >= ${t.shadow_or_simulation_min}`);
    if (e.unresolved_critical_findings > 0) missing.push("no unresolved critical findings");
  } else if (next === "act_with_confirmation") {
    const a = live(e.consecutive_agreements);
    if (!a || a.count < t.consecutive_agreements_min) missing.push(`>= ${t.consecutive_agreements_min} consecutive recommendation/human agreements (non-simulated)`);
  } else if (next === "act_bounded") {
    if (!live(e.shadow_evidence)) missing.push("non-simulated shadow evidence");
    if (!live(e.rollback_verified)) missing.push("rollback verified (non-simulated)");
    if (!e.policy_conformance) missing.push("policy conformance");
    if (e.risk_tier > 3) missing.push("risk tier <= 3");
  } else {
    const p = live(e.sustained_production);
    if (!p || p.days < t.sustained_production_days_min) missing.push(`sustained production performance >= ${t.sustained_production_days_min} days`);
    const d = live(e.discrepancy_rate);
    if (!d || d.value >= t.discrepancy_rate_max) missing.push(`discrepancy rate below ${t.discrepancy_rate_max}`);
    if (e.critical_incidents_in_period > 0) missing.push("no critical incidents in period");
    if (e.risk_tier > 3) missing.push("risk tier <= 3");
    if (!e.explicit_human_grant_ref) missing.push("explicit human grant");
  }
  // 6.2 PROHIBITED: Tier 4 autonomy without independent judgment, monitoring and an armed kill switch.
  if (e.risk_tier === 4 && rank(next) >= rank("act_bounded")) {
    if (!e.independent_human_judgment_ref) missing.push("Tier 4: independently-authorised human judgment");
    if (!e.continuous_monitoring) missing.push("Tier 4: continuous monitoring");
    if (!e.kill_switch_armed) missing.push("Tier 4: armed kill switch");
  }
  return missing.length ? { promote: false, to: current, missing } : { promote: true, to: next, missing };
}

/** NON-NEGOTIABLE 6.2 demotion triggers, in source order. */
export const DEMOTION_TRIGGERS = [
  "discrepancy_rate_exceeded",
  "critical_or_repeated_incident",
  "policy_or_guardrail_changed",
  "capability_version_changed_materially",
  "data_distribution_shift",
  "model_route_or_version_changed",
  "authority_effective_to_lapsed",
  "steward_unassigned",
  "value_review_underperformance",
] as const;
export type DemotionTrigger = (typeof DEMOTION_TRIGGERS)[number];
/**
 * Triggers that invalidate the basis of the authority reset it to `observe` and re-run the promotion path
 * (21.2: "Version changed materially → demoted to observe"). Performance triggers step down one level.
 * DESIGN DECISION: Part 6.2 says "decreases"; the reset/step split is ours. Mirrored in SQL `_demotion_target`.
 */
export const RESET_TRIGGERS: readonly DemotionTrigger[] = [
  "policy_or_guardrail_changed", "capability_version_changed_materially", "model_route_or_version_changed",
  "authority_effective_to_lapsed", "steward_unassigned", "critical_or_repeated_incident",
];
export function demote(current: Level, trigger: DemotionTrigger): { from: Level; to: Level; trigger: DemotionTrigger; changed: boolean } {
  const to: Level = RESET_TRIGGERS.includes(trigger) ? "observe" : LADDER[Math.max(0, rank(current) - 1)]!;
  return { from: current, to, trigger, changed: to !== current };
}

// ---------------------------------------------------------------- 6.6 guardrails-as-code
export interface GuardrailRow { id: string; category: string; evaluator: string; enforcement: "advisory" | "enforcing"; params: Record<string, unknown>; version: string }
export interface GuardrailResult { guardrail_id: string; evaluator: string; enforcement: "advisory" | "enforcing"; passed: boolean; finding: string | null }
export interface ActionContext {
  action: string;
  object: { id?: string; type: string; owner_id?: string | null; steward_id?: string | null; risk_tier: Tier; consequence_class: Consequence; data_classification: Sensitivity; has_expiration?: boolean; has_telemetry?: boolean };
  actor: { kind: "human" | "agent" | "system"; id: string; authority: Level };
  /** encoded authority for this actor+action (AuthorityGrant), if any */
  grant?: { level: Level; effective_to: string | null; attestation_expires_at?: string | null } | null;
  content_text?: string;
  route?: { cleared_tiers: ContentTier[]; attestation_expiry: string | null } | null;
  flags?: Partial<Record<ProhibitedKey, boolean>>;
  citations_present?: boolean;
  explanation_present?: boolean;
  now: string;
}

type Evaluator = (ctx: ActionContext, params: Record<string, unknown>) => { passed: boolean; finding: string | null };
/** Registered deterministic evaluators, one per Part 6.6 category. An LLM may propose; only these enforce. */
export const EVALUATORS: Record<string, Evaluator> = {
  principle_conformance: (ctx) => ({ passed: !!ctx.explanation_present || ctx.object.risk_tier <= 2, finding: ctx.explanation_present || ctx.object.risk_tier <= 2 ? null : "No explanation of how this conforms to the governing principles" }),
  policy_rule: (ctx) => {
    const ok = !!ctx.object.owner_id;
    return { passed: ok, finding: ok ? null : "Rule: every consequential action has a named owner" };
  },
  risk_appetite: (ctx, p) => {
    const max = Number(p["max_autonomous_tier"] ?? 3);
    const auto = rank(ctx.actor.authority) >= rank("act_bounded");
    const ok = !(auto && ctx.object.risk_tier > max);
    return { passed: ok, finding: ok ? null : `Automatic action above risk appetite (tier ${ctx.object.risk_tier} > ${max})` };
  },
  model_data_governance: (ctx) => {
    if (!ctx.route) return { passed: true, finding: null };
    const tier = ctx.content_text ? classifyContent(ctx.content_text).tier : "A";
    if (!ctx.route.cleared_tiers.includes(tier)) return { passed: false, finding: `Route not cleared for Tier ${tier}` };
    if (ctx.route.attestation_expiry && ctx.route.attestation_expiry < ctx.now) return { passed: false, finding: "Provider attestation expired" };
    return { passed: true, finding: null };
  },
  human_oversight: (ctx) => {
    const ok = !(ctx.object.risk_tier >= 3 && ctx.actor.kind !== "human" && rank(ctx.actor.authority) < rank("act_with_confirmation"));
    return { passed: ok, finding: ok ? null : "Tier 3+ agent action needs at least act_with_confirmation" };
  },
  transparency_citation: (ctx) => ({ passed: ctx.citations_present !== false, finding: ctx.citations_present === false ? "Generated guidance without citations" : null }),
};

export function runGuardrails(ctx: ActionContext, rows: GuardrailRow[]): GuardrailResult[] {
  return rows.map((g) => {
    const ev = EVALUATORS[g.evaluator];
    if (!ev) return { guardrail_id: g.id, evaluator: g.evaluator, enforcement: g.enforcement, passed: false, finding: `Unknown evaluator ${g.evaluator}: cannot enforce` };
    const r = ev(ctx, g.params);
    return { guardrail_id: g.id, evaluator: g.evaluator, enforcement: g.enforcement, ...r };
  });
}

// ---------------------------------------------------------------- 6.7 prohibited conditions
export const PROHIBITED_CONDITIONS = {
  rights_safety_life_without_independent_judgment: "Any action affecting rights, safety or life without independent human judgment",
  prohibited_class_data_to_route: "Sending prohibited-class data to any route, ever",
  production_deploy_without_exposure_authorization: "Automated deployment to production without an ExposureAuthorization and an armed kill switch",
  capability_to_production_without_owner_telemetry_expiration: "A capability with no owner, no telemetry or no expiration condition entering production",
  high_impact_tool_call_without_policy: "A high-impact tool call without deterministic policy evaluation and provenance",
  behavior_without_confirmed_decision_reaching_creation: "A Behaviour Statement without a Confirmed Decision ancestor reaching creation",
  capability_without_contract_published: "A Composable Capability without a Capability Contract being published to the fabric",
  canon_change_without_version_evidence_window: "Canon change without versioning, evidence and a challenge window",
  surveillance_inference: "Any inference listed in Part 14.3 (surveillance boundaries)",
} as const;
export type ProhibitedKey = keyof typeof PROHIBITED_CONDITIONS;

/** Part 14.3 — individual activity metrics are refused at generation time. */
const SURVEILLANCE = /\b(individual|per[- ]person|per[- ]user|each (?:person|employee|builder))\b.*\b(activity|productivity|output|keystrokes?|time on|presence|sentiment|performance score)\b/i;

export function prohibitedConditions(ctx: ActionContext): ProhibitedKey[] {
  const f = ctx.flags ?? {};
  const hits = new Set<ProhibitedKey>();
  for (const k of Object.keys(PROHIBITED_CONDITIONS) as ProhibitedKey[]) if (f[k]) hits.add(k);
  if (ctx.object.data_classification === "prohibited" && ctx.route) hits.add("prohibited_class_data_to_route");
  if (ctx.content_text && SURVEILLANCE.test(ctx.content_text)) hits.add("surveillance_inference");
  if (ctx.action === "promote_to_production" && (!ctx.object.owner_id || ctx.object.has_telemetry === false || ctx.object.has_expiration === false))
    hits.add("capability_to_production_without_owner_telemetry_expiration");
  return [...hits];
}

// ---------------------------------------------------------------- 6.4 decision pattern
export type Decision = "proceed" | "proceed_with_confirmation" | "escalate_human_decision" | "block";
export type Treatment =
  | "automatic_release" | "act_with_confirmation" | "limited_exposure_with_observation" | "recommend"
  | "explicit_human_decision" | "explicit_human_decision_independent" | "cannot_proceed" | "hard_block" | "route_refused";
export interface AuthorityOutcome {
  decision: Decision;
  treatment: Treatment;
  policy_decision: "allow" | "allow_with_conditions" | "deny" | "escalate";
  conditions: string[];
  rule_ids: string[];
  explanation: string;
  independent: boolean;
  content_tier: ContentTier;
  prohibited: ProhibitedKey[];
  guardrails: GuardrailResult[];
  confidence: { overall: number; band: Band };
  engine: string;
}

const LOW_CONSEQUENCE: Consequence[] = ["none", "reversible"];
const INDEPENDENT: Consequence[] = ["rights_affecting", "safety", "lifeline"];

/**
 * Order (first match wins): Tier C → prohibited → lapsed authority → enforcing guardrail failure →
 * rights/safety/life or Tier 4 → irreversible → moderate confidence → low confidence → high confidence.
 */
export function evaluateAuthority(ctx: ActionContext, bundle: BundleInput, guardrails: GuardrailRow[]): AuthorityOutcome {
  const tier = ctx.content_text ? classifyContent(ctx.content_text).tier : "A";
  const conf = computeOverall(bundle, ctx.object.risk_tier);
  const prohibited = prohibitedConditions(ctx);
  const results = runGuardrails(ctx, guardrails);
  const base = { content_tier: tier, prohibited, guardrails: results, confidence: { overall: conf.overall, band: conf.band }, engine: ENGINE_ID, independent: false, conditions: [] as string[] };
  const out = (decision: Decision, treatment: Treatment, rule_ids: string[], explanation: string, extra: Partial<AuthorityOutcome> = {}): AuthorityOutcome => {
    const policy_decision = decision === "block" ? "deny" : decision === "escalate_human_decision" ? "escalate" : (extra.conditions ?? []).length || decision === "proceed_with_confirmation" ? "allow_with_conditions" : "allow";
    return { ...base, decision, treatment, rule_ids, explanation, policy_decision, ...extra };
  };

  if (tier === "C") return out("block", "hard_block", ["CT-C"], "Tier C content (PHI or a payment card number): hard block, nothing is stored or sent.");
  if (prohibited.length) return out("block", "cannot_proceed", prohibited.map((p) => `PC-${p}`), `Prohibited condition: ${prohibited.map((p) => PROHIBITED_CONDITIONS[p]).join("; ")}.`);
  if (ctx.grant) {
    const lapsed = (ctx.grant.effective_to && ctx.grant.effective_to < ctx.now) || (ctx.grant.attestation_expires_at && ctx.grant.attestation_expires_at < ctx.now);
    if (lapsed) return out("block", "route_refused", ["AU-lapsed"], "The authority has lapsed (effective_to or attestation passed without renewal): route refused.");
  }
  const failedEnforcing = results.filter((r) => r.enforcement === "enforcing" && !r.passed);
  const advisory = results.filter((r) => r.enforcement === "advisory" && !r.passed).map((r) => `advisory: ${r.finding}`);
  if (failedEnforcing.length) return out("block", "cannot_proceed", failedEnforcing.map((r) => `GR-${r.evaluator}`), `Enforcing guardrail failed: ${failedEnforcing.map((r) => r.finding).join("; ")}.`);
  const withAdv = (c: string[]) => [...c, ...advisory];

  if (INDEPENDENT.includes(ctx.object.consequence_class) || ctx.object.risk_tier === 4)
    return out("escalate_human_decision", "explicit_human_decision_independent", ["DM-independent"], "Rights-, safety- or life-affecting, or Tier 4: an independent accountable human decides.", { independent: true, conditions: withAdv([]) });
  if (ctx.object.consequence_class === "irreversible")
    return out("escalate_human_decision", "explicit_human_decision", ["DM-consequential"], "Irreversible consequence: an accountable human decides.", { conditions: withAdv([]) });
  if (conf.band === "moderate")
    return out("proceed", "limited_exposure_with_observation", ["DM-moderate"], `Moderate confidence (${conf.overall}): limited exposure with observation.`, { conditions: withAdv(["limited_exposure", "enhanced_observation"]) });
  if (conf.band === "low") {
    if (!LOW_CONSEQUENCE.includes(ctx.object.consequence_class))
      return out("escalate_human_decision", "explicit_human_decision", ["DM-low-consequential"], `Low confidence (${conf.overall}) with a consequential outcome: an accountable human decides.`, { conditions: withAdv([]) });
    const bounded = rank(ctx.actor.authority) >= rank("act_bounded");
    return bounded
      ? out("proceed", "limited_exposure_with_observation", ["DM-low"], `Low confidence (${conf.overall}), low consequence: limited exposure with observation.`, { conditions: withAdv(["limited_exposure", "enhanced_observation"]) })
      : out("proceed_with_confirmation", "recommend", ["DM-low"], `Low confidence (${conf.overall}), low consequence: recommend to a human.`, { conditions: withAdv(["recommend_only"]) });
  }
  // high confidence
  const encoded = !!ctx.grant && rank(ctx.grant.level) >= rank("act_bounded") && ctx.object.risk_tier <= 3;
  if (LOW_CONSEQUENCE.includes(ctx.object.consequence_class) && encoded && ctx.object.risk_tier <= 2)
    return out("proceed", "automatic_release", ["DM-high-encoded"], `High confidence (${conf.overall}), low consequence, encoded authority: automatic release.`, { conditions: withAdv([]) });
  return out("proceed_with_confirmation", "act_with_confirmation", [encoded ? "DM-tier3-owner" : "DM-high-no-encoded"],
    encoded ? "High confidence but tier 3 or a costly consequence: consequence-owner confirmation." : `High confidence (${conf.overall}) without encoded authority yet: act with confirmation.`,
    { conditions: withAdv(["human_confirmation"]) });
}

// ---------------------------------------------------------------- 6.5 Human Decision Queue
export const HDR_FIELDS = [
  "exact_decision_required", "reason_ai_cannot_safely_decide", "current_evidence_and_confidence", "ai_recommendation",
  "viable_alternatives", "affected_parties", "deadline", "cost_of_waiting", "reversibility", "current_authority_boundary",
  "proposed_next_machine_action",
] as const;
export type HdrField = (typeof HDR_FIELDS)[number];
/** The four human responses Part 6.5 guarantees, and nothing else. */
export const HDR_RESPONSES = ["decide", "request_clarification", "reduce_authority", "stop_mission"] as const;

export function hdrHasExactFields(body: Record<string, unknown>): boolean {
  const keys = Object.keys(body).sort();
  return keys.length === HDR_FIELDS.length && [...HDR_FIELDS].sort().every((k, i) => k === keys[i]);
}

/** Part 6.8 target: >= 80% of consequential actions resolved with no human wait. */
export function noWaitRatio(outcomes: Decision[]): number | null {
  if (!outcomes.length) return null;
  return outcomes.filter((d) => d !== "escalate_human_decision").length / outcomes.length;
}
