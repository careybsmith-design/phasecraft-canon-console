import { describe, expect, it } from "vitest";
import {
  assessRisk, overrideTier, computeOverall, evaluateAuthority, evaluatePromotion, demote, DEMOTION_TRIGGERS,
  hdrHasExactFields, HDR_FIELDS, type ActionContext, type BundleInput, type GuardrailRow, type Consequence, type Tier,
} from "@/server/authority/engine";
import { classifyContent } from "./content-tier";
import { measureRecall } from "./phi-pan-corpus";
import { LIFECYCLE_FAMILIES, APPROVAL_STATE_PATTERN } from "./lifecycle";

const NOW = "2026-10-16T00:00:00Z";
const refs = ["00000000-0000-0000-0000-000000000001"];
function bundle(v: number): BundleInput {
  const d = { value: v, evidence_refs: refs };
  return { intent_alignment: d, simulation_performance: d, adversarial_results: d, security_privacy_evidence: d, accessibility_reliability: d,
    capability_pattern_conformance: d, reversibility_rollback: d, impact_assessment: d, shadow_results: d, data_quality_lineage: d, owner_confidence: { value: v } };
}
const GR: GuardrailRow[] = [
  { id: "g1", category: "policies", evaluator: "policy_rule", enforcement: "enforcing", params: {}, version: "1" },
  { id: "g2", category: "risk_appetite", evaluator: "risk_appetite", enforcement: "enforcing", params: { max_autonomous_tier: 3 }, version: "1" },
  { id: "g3", category: "principles", evaluator: "principle_conformance", enforcement: "advisory", params: {}, version: "1" },
];
function ctx(c: Consequence, opts: Partial<ActionContext> & { tier?: Tier } = {}): ActionContext {
  return {
    action: "release", now: NOW,
    object: { type: "ComposableCapability", owner_id: "o", risk_tier: opts.tier ?? 1, consequence_class: c, data_classification: "internal" },
    actor: { kind: "agent", id: "a", authority: "act_bounded" },
    grant: { level: "act_bounded", effective_to: "2027-01-01T00:00:00Z" },
    ...opts,
  };
}

describe("21.2 authority test matrix (risk × confidence × consequence)", () => {
  it("high confidence, low consequence, encoded authority → automatic release", () => {
    expect(evaluateAuthority(ctx("none"), bundle(0.9), GR).treatment).toBe("automatic_release");
    expect(evaluateAuthority(ctx("reversible"), bundle(0.95), GR).decision).toBe("proceed");
  });
  it("high confidence, low consequence, no encoded authority → act with confirmation", () => {
    const r = evaluateAuthority(ctx("none", { grant: null }), bundle(0.9), GR);
    expect(r.treatment).toBe("act_with_confirmation");
    expect(r.decision).toBe("proceed_with_confirmation");
  });
  it.each(["none", "reversible", "costly_reversible"] as Consequence[])("moderate confidence, %s → limited exposure with observation", (c) => {
    expect(evaluateAuthority(ctx(c), bundle(0.6), GR).treatment).toBe("limited_exposure_with_observation");
  });
  it("Part 6.4: low confidence always requires an accountable-human decision", () => {
    expect(evaluateAuthority(ctx("none"), bundle(0.2), GR).decision).toBe("escalate_human_decision");
    expect(evaluateAuthority(ctx("none", { actor: { kind: "agent", id: "a", authority: "recommend" } }), bundle(0.2), GR).treatment).toBe("explicit_human_decision");
  });
  it("moderate confidence cannot execute with observe authority or without an encoded grant", () => {
    expect(evaluateAuthority(ctx("none", { actor: { kind: "agent", id: "a", authority: "observe" } }), bundle(0.6), GR).decision).toBe("proceed_with_confirmation");
    expect(evaluateAuthority(ctx("none", { grant: null }), bundle(0.6), GR).decision).toBe("proceed_with_confirmation");
  });
  it("high confidence cannot manufacture execution authority for an observer", () => {
    expect(evaluateAuthority(ctx("none", { actor: { kind: "agent", id: "a", authority: "observe" } }), bundle(0.99), GR).decision).toBe("proceed_with_confirmation");
  });
  it("high confidence, irreversible → explicit human decision", () => {
    const r = evaluateAuthority(ctx("irreversible", { tier: 3 }), bundle(0.95), GR);
    expect(r.treatment).toBe("explicit_human_decision");
    expect(r.policy_decision).toBe("escalate");
  });
  it.each(["rights_affecting", "safety", "lifeline"] as Consequence[])("any confidence, %s → explicit independent human decision", (c) => {
    for (const v of [0.1, 0.6, 0.99]) {
      const r = evaluateAuthority(ctx(c, { tier: 4 }), bundle(v), GR);
      expect(r.treatment).toBe("explicit_human_decision_independent");
      expect(r.independent).toBe(true);
    }
  });
  it("any confidence, prohibited condition → cannot proceed", () => {
    for (const v of [0.1, 0.99]) {
      const r = evaluateAuthority(ctx("none", { flags: { high_impact_tool_call_without_policy: true } }), bundle(v), GR);
      expect(r.decision).toBe("block");
      expect(r.treatment).toBe("cannot_proceed");
    }
    expect(evaluateAuthority(ctx("none", { content_text: "Show per-person activity and productivity for each builder" }), bundle(0.99), GR).prohibited).toContain("surveillance_inference");
  });
  it("any confidence, Tier C content → hard block", () => {
    const r = evaluateAuthority(ctx("none", { content_text: "card 4111 1111 1111 1111" }), bundle(0.99), GR);
    expect(r.treatment).toBe("hard_block");
    expect(r.content_tier).toBe("C");
  });
  it("authority lapsed (effective_to or attestation) → route refused", () => {
    expect(evaluateAuthority(ctx("none", { grant: { level: "act_bounded", effective_to: "2026-01-01T00:00:00Z" } }), bundle(0.99), GR).treatment).toBe("route_refused");
    expect(evaluateAuthority(ctx("none", { grant: { level: "act_bounded", effective_to: null, attestation_expires_at: "2026-01-01T00:00:00Z" } }), bundle(0.99), GR).treatment).toBe("route_refused");
  });
  it("version changed materially → demoted to observe", () => {
    expect(demote("act_bounded", "capability_version_changed_materially").to).toBe("observe");
  });
  it("enforcing guardrail failure blocks; advisory failure only adds a condition", () => {
    expect(evaluateAuthority(ctx("none", { object: { type: "X", owner_id: null, risk_tier: 1, consequence_class: "none", data_classification: "internal" } }), bundle(0.9), GR).decision).toBe("block");
    const adv = evaluateAuthority(ctx("none", { tier: 3, grant: null }), bundle(0.9), GR);
    expect(adv.decision).not.toBe("block");
    expect(adv.conditions.some((c) => c.startsWith("advisory:"))).toBe(true);
  });
});

describe("6.1 risk tiers", () => {
  const base = { consequence: "none", sensitivity: "internal", autonomy: 0.1, reversibility: "trivial", exposure: "internal_only", novelty: "established_pattern", evidence: 0.9 } as const;
  it("low inputs give tier 1; rights-affecting gives tier 4", () => {
    expect(assessRisk(base, NOW).computed_tier).toBe(1);
    expect(assessRisk({ ...base, consequence: "rights_affecting" }, NOW).computed_tier).toBe(4);
  });
  it("downward override is prohibited; upward needs a rationale", () => {
    expect(() => overrideTier(3, 2, "cheaper")).toThrow(/DOWNWARD/);
    expect(() => overrideTier(2, 3, "")).toThrow(/RATIONALE/);
    expect(overrideTier(2, 3, "regulator interest")).toBe(3);
  });
});

describe("6.3 published confidence rule", () => {
  it("overall is the weakest required dimension; missing evidence counts as 0", () => {
    const b = bundle(0.9);
    b.shadow_results = { value: 0.9, evidence_refs: [] };
    expect(computeOverall(b, 1).overall).toBe(0.9); // shadow not required at tier 1
    expect(computeOverall(b, 3).overall).toBe(0); // required at tier 3
  });
});

describe("6.2 ladder", () => {
  it("simulated evidence never promotes", () => {
    const e = { shadow_or_simulation_score: { value: 0.99, simulated: true }, unresolved_critical_findings: 0, policy_conformance: true, risk_tier: 1 as Tier, critical_incidents_in_period: 0 };
    expect(evaluatePromotion("observe", e).promote).toBe(false);
    expect(evaluatePromotion("observe", { ...e, shadow_or_simulation_score: { value: 0.99, simulated: false } }).to).toBe("recommend");
  });
  it("Tier 4 cannot reach bounded or autonomous action without independent judgment, monitoring and kill switch", () => {
    const e = { shadow_evidence: { simulated: false }, rollback_verified: { simulated: false }, policy_conformance: true, risk_tier: 4 as Tier, unresolved_critical_findings: 0, critical_incidents_in_period: 0 };
    expect(evaluatePromotion("act_with_confirmation", e).missing.join()).toMatch(/kill switch/);
  });
  it.each(DEMOTION_TRIGGERS)("demotion fires automatically on %s", (t) => {
    const r = demote("autonomous_with_exception", t);
    expect(r.changed).toBe(true);
    expect(LADDER_RANK(r.to)).toBeLessThan(LADDER_RANK("autonomous_with_exception"));
  });
});
const LADDER_RANK = (l: string) => ["observe", "recommend", "act_with_confirmation", "act_bounded", "autonomous_with_exception"].indexOf(l);

describe("6.5 Human Decision Queue", () => {
  it("a request has exactly the Part 6.5 fields and nothing more", () => {
    const ok = Object.fromEntries(HDR_FIELDS.map((f) => [f, "x"]));
    expect(hdrHasExactFields(ok)).toBe(true);
    expect(hdrHasExactFields({ ...ok, status: "awaiting" })).toBe(false);
    const { deadline: _d, ...missing } = ok;
    expect(hdrHasExactFields(missing)).toBe(false);
  });
});

describe("PHI/PAN labelled corpus", () => {
  it("recall is 100% and no false blocks", () => {
    const m = measureRecall(classifyContent);
    expect(m.misses).toEqual([]);
    expect(m.recall).toBe(1);
    expect(m.positives).toBeGreaterThanOrEqual(25);
  });
});

describe("no approval states anywhere", () => {
  it("no lifecycle state matches the approval pattern", () => {
    expect(Object.values(LIFECYCLE_FAMILIES).flat(2).filter((s) => APPROVAL_STATE_PATTERN.test(s))).toEqual([]);
  });
});
