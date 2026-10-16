/**
 * Phase 3 server functions: authority engine evaluations, the Human Decision Queue, council escalation, exit evidence.
 * The engine (src/server/authority/engine.ts) is pure and is loaded inside handlers only.
 * Every evaluation writes a PolicyEvaluation object (ledger-first via thread_create_object).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Json = Record<string, unknown>;
const human = (id: string) => ({ kind: "human", id, authority_used: "observe" });
const system = (id: string) => ({ kind: "system", id, authority_used: "observe", engine: "thread.authority.engine@1.0.0" });
async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}
async function engine() {
  return import("@/server/authority/engine");
}
function err(message: string): Error {
  const code = message.split(":")[0]?.trim() || "ERROR";
  return new Error(JSON.stringify({ code, explanation: message }));
}
function envelope(type: string, title: string, statement: string, body: Json, ownerId: string, extra: Json = {}) {
  return {
    type, title: title.slice(0, 200), statement: statement.slice(0, 4000), machine_description: `${type} recorded by the authority engine`,
    body, review_date: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10),
    expiration_condition: { kind: "review_date_passes" }, retirement_path: { mode: "archive_evidence" },
    risk_tier: "1", owner_id: ownerId, permission: { roles: [], purpose: "authority and decisions (Part 6)" },
    data_classification: "internal", rationale: `${type} (Part 6)`, ...extra,
  };
}

const DIM = z.object({ value: z.number().min(0).max(1), evidence_refs: z.array(z.string()).default([]) });
const EvalInput = z.object({
  object_id: z.string().uuid(),
  action: z.string().trim().min(1).max(120),
  dimensions: z.record(DIM).default({}),
  owner_confidence: z.number().min(0).max(1).optional(),
  content_text: z.string().max(4000).optional(),
  flags: z.record(z.boolean()).default({}),
  agent: z.boolean().default(true),
  risk: z.object({
    sensitivity: z.enum(["public", "internal", "confidential", "restricted", "prohibited"]).optional(),
    autonomy: z.number().min(0).max(1).default(0.5),
    reversibility: z.enum(["trivial", "assisted", "difficult", "impossible"]).default("assisted"),
    exposure: z.enum(["internal_only", "limited_population", "full_population", "external_parties"]).default("internal_only"),
    novelty: z.enum(["established_pattern", "adapted_pattern", "novel"]).default("established_pattern"),
  }).default({}),
});

export const getAuthorityOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [g, r, h, pe, ra] = await Promise.all([
      sb.from("guardrails").select("id,category,evaluator,enforcement,params,version,active,proposed_by").eq("active", true).order("category"),
      sb.from("confidence_rules").select("version,definition,published_at").order("published_at", { ascending: false }),
      sb.from("authority_history").select("id,object_id,from_level,to_level,cause,trigger,at").order("id", { ascending: false }).limit(30),
      sb.from("objects").select("id,human_ref,title,body,created_at").eq("type", "PolicyEvaluation").eq("is_tombstone", false).order("created_at", { ascending: false }).limit(20),
      sb.from("risk_assessments").select("id,object_id,computed_tier,treatment,reasons,computed_at").order("computed_at", { ascending: false }).limit(10),
    ]);
    const e = await engine();
    return {
      guardrails: g.data ?? [], rules: r.data ?? [], history: h.data ?? [], evaluations: pe.data ?? [], risks: ra.data ?? [],
      ladder: [...e.LADDER], triggers: [...e.DEMOTION_TRIGGERS], prohibited: e.PROHIBITED_CONDITIONS, thresholds: e.PROMOTION_THRESHOLDS,
    };
  });

export const evaluateAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EvalInput.parse(d))
  .handler(async ({ data, context }) => {
    const e = await engine();
    const { classifyContent } = await import("@/domain/content-tier");
    const { data: obj, error } = await context.supabase.from("objects")
      .select("id,human_ref,type,title,owner_id,steward_id,risk_tier,consequence_class,data_classification,authority_level,expiration_condition")
      .eq("id", data.object_id).maybeSingle();
    if (error) throw err(error.message);
    if (!obj) throw err("NOT_FOUND: object not visible to you");
    const db = await admin();
    const now = new Date().toISOString();
    const [{ data: grs }, { data: grants }] = await Promise.all([
      db.from("guardrails").select("id,category,evaluator,enforcement,params,version").eq("active", true),
      db.from("objects").select("id,body").eq("type", "AuthorityGrant").eq("is_tombstone", false).eq("body->>subject_ref", obj.id).order("created_at", { ascending: false }).limit(1),
    ]);
    const g = grants?.[0]?.body as Json | undefined;
    const tierIn = classifyContent(data.content_text ?? "");
    // 6.1: risk is computed first and stored with its inputs; it never lowers the stored tier.
    const risk = e.assessRisk({
      consequence: obj.consequence_class as never, sensitivity: data.risk.sensitivity ?? (obj.data_classification as never),
      autonomy: data.risk.autonomy, reversibility: data.risk.reversibility, exposure: data.risk.exposure, novelty: data.risk.novelty,
      evidence: Object.values(data.dimensions).filter((d) => d.evidence_refs.length).length / e.CONFIDENCE_DIMENSIONS.length,
    }, now);
    const tier = Math.max(Number(obj.risk_tier), risk.computed_tier) as 1 | 2 | 3 | 4;
    const ctx = {
      action: data.action, now,
      object: { id: obj.id, type: obj.type, owner_id: obj.owner_id, steward_id: obj.steward_id, risk_tier: tier, consequence_class: obj.consequence_class as never, data_classification: obj.data_classification as never, has_expiration: !!obj.expiration_condition },
      actor: data.agent ? { kind: "agent" as const, id: `agent-for:${obj.id}`, authority: obj.authority_level as never } : { kind: "human" as const, id: context.userId, authority: obj.authority_level as never },
      grant: g ? { level: g["authority_level"] as never, effective_to: (g["effective_to"] as string) ?? null, attestation_expires_at: (g["attestation_expires_at"] as string) ?? null } : null,
      ...(data.content_text ? { content_text: data.content_text } : {}), flags: data.flags,
    };
    const bundle = { ...data.dimensions, owner_confidence: data.owner_confidence !== undefined ? { value: data.owner_confidence } : undefined };
    const out = e.evaluateAuthority(ctx, bundle as never, (grs ?? []) as never);
    const actor = system(context.userId);
    await db.rpc("thread_record_risk", { p_actor: human(context.userId), p_id: obj.id, p: { inputs: { ...risk, reasons: undefined }, computed_tier: String(risk.computed_tier), treatment: risk.treatment, reasons: risk.reasons, computed_by: risk.computed_by } } as never);
    // Raw text is never stored: only the tier and the reasons.
    const inputs = { action: data.action, risk_tier: tier, consequence_class: obj.consequence_class, content_tier: tierIn.tier, content_reasons: tierIn.reasons,
      dimensions: data.dimensions, flags: data.flags, grant_ref: grants?.[0]?.id ?? null, authority_level: obj.authority_level };
    const pe = await db.rpc("thread_create_object", {
      p_actor: actor,
      p: envelope("PolicyEvaluation", `${out.treatment.replaceAll("_", " ")}: ${data.action} on ${obj.human_ref}`, out.explanation, {
        policy_ref: out.rule_ids, subject_ref: obj.id, inputs, decision: out.policy_decision, conditions: out.conditions,
        decided_by: out.engine, deterministic: true, treatment: out.treatment, engine_decision: out.decision,
        guardrail_results: out.guardrails, prohibited: out.prohibited, confidence: out.confidence, confidence_rule: e.CONFIDENCE_RULE.version,
      }, context.userId, { evidence_refs: [] }) as never,
    });
    if (pe.error) throw err(pe.error.message);
    const peRow = pe.data as { id: string; human_ref: string };
    let hdr: { id: string; human_ref: string } | null = null;
    if (out.decision === "escalate_human_decision") {
      const body = {
        exact_decision_required: `May "${data.action}" proceed on ${obj.human_ref} (${obj.title})?`,
        reason_ai_cannot_safely_decide: out.explanation,
        current_evidence_and_confidence: peRow.id,
        ai_recommendation: out.confidence.band === "high" ? "Proceed under limited exposure with rollback armed" : "Do not proceed until evidence improves",
        viable_alternatives: [
          { option: "Proceed", consequences: `Acts with ${obj.consequence_class} consequence`, affected_parties: ["consequence owner"] },
          { option: "Proceed with limited exposure", consequences: "Smaller population, enhanced observation", affected_parties: ["limited population"] },
          { option: "Do not proceed", consequences: "Value is delayed; no new risk", affected_parties: ["mission"] },
        ],
        affected_parties: ["consequence owner", "affected population"],
        deadline: new Date(Date.now() + 3 * 864e5).toISOString(),
        cost_of_waiting: "The action does not happen until a human decides.",
        reversibility: obj.consequence_class,
        current_authority_boundary: { object_id: obj.id, level: obj.authority_level, grant_ref: grants?.[0]?.id ?? null, independent_judgment_required: out.independent },
        proposed_next_machine_action: `Run "${data.action}" as decided, then record the outcome`,
      };
      const h = await db.rpc("thread_create_object", { p_actor: actor, p: envelope("HumanDecisionRequest", `Decide: ${data.action} on ${obj.human_ref}`, body.exact_decision_required, body, obj.owner_id ?? context.userId, { risk_tier: String(tier) }) as never });
      if (h.error) throw err(h.error.message);
      hdr = h.data as { id: string; human_ref: string };
    }
    return { outcome: out, risk, policy_evaluation: peRow, decision_request: hdr };
  });

export const listDecisionQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [{ data: reqs, error }, { data: decs }] = await Promise.all([
      sb.from("objects").select("id,human_ref,title,body,created_at,owner_id").eq("type", "HumanDecisionRequest").eq("is_tombstone", false).order("created_at", { ascending: false }).limit(100),
      sb.from("objects").select("id,human_ref,body,created_at,created_by").eq("type", "Decision").eq("is_tombstone", false).limit(500),
    ]);
    if (error) throw err(error.message);
    return (reqs ?? []).map((r) => {
      const ds = (decs ?? []).filter((d) => (d.body as Json)["request_ref"] === r.id);
      const closing = ds.find((d) => (d.body as Json)["response"] !== "request_clarification");
      return { ...r, decisions: ds, open: !closing, clarification_used: ds.some((d) => (d.body as Json)["response"] === "request_clarification") };
    });
  });

const RespondInput = z.object({
  request_id: z.string().uuid(),
  response: z.enum(["decide", "request_clarification", "reduce_authority", "stop_mission"]),
  decision: z.string().trim().min(1).max(2000),
  rationale: z.string().trim().min(1).max(2000),
  reduce_to: z.enum(["observe", "recommend", "act_with_confirmation", "act_bounded"]).optional(),
});

export const respondToDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RespondInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: req } = await context.supabase.from("objects").select("id,human_ref,body,owner_id").eq("id", data.request_id).eq("type", "HumanDecisionRequest").maybeSingle();
    if (!req) throw err("NOT_FOUND: decision request");
    const { data: isSteward } = await context.supabase.rpc("has_role", { _uid: context.userId, _role: "steward" } as never);
    const boundary = (req.body as Json)["current_authority_boundary"] as { object_id?: string; independent_judgment_required?: boolean } | undefined;
    const subjectId = boundary?.object_id;
    let subjectOwner: string | null = null;
    if (subjectId) subjectOwner = (await context.supabase.from("objects").select("owner_id").eq("id", subjectId).maybeSingle()).data?.owner_id ?? null;
    if (!isSteward && context.userId !== req.owner_id && context.userId !== subjectOwner) throw err("FORBIDDEN: only the accountable owner or a steward decides");
    const db = await admin();
    const actor = { kind: "human", id: context.userId, authority_used: "act_with_confirmation" };
    const d = await db.rpc("thread_create_object", {
      p_actor: actor,
      p: envelope("Decision", `${data.response.replaceAll("_", " ")}: ${req.human_ref}`, data.decision, {
        request_ref: req.id, response: data.response, decision: data.decision, decided_by: context.userId, authority_used: "act_with_confirmation",
        rationale: data.rationale, effective_from: new Date().toISOString(), reversal_of: null,
        independent: !!boundary?.independent_judgment_required,
      }, context.userId) as never,
    });
    if (d.error) throw err(d.error.message);
    const dec = d.data as { id: string; human_ref: string };
    if (subjectId && (data.response === "reduce_authority" || data.response === "stop_mission")) {
      const to = data.response === "stop_mission" ? "observe" : data.reduce_to ?? "observe";
      const { data: cur } = await db.from("objects").select("authority_level").eq("id", subjectId).single();
      const ladder = ["observe", "recommend", "act_with_confirmation", "act_bounded", "autonomous_with_exception"];
      if (cur && ladder.indexOf(to) < ladder.indexOf(cur.authority_level)) {
        const s = await db.rpc("thread_set_authority", { p_actor: actor, p_id: subjectId, p_to: to, p_cause: "withdrawal", p_trigger: data.response, p_evidence: [dec.id], p_conditions: { trigger_ref: dec.id } } as never);
        if (s.error) throw err(s.error.message);
      }
    }
    return dec;
  });

/** 6.8: the council returns guidance and decisions, recorded as a ConfirmedDecision with source governance_council — never a gate. */
export const recordCouncilDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ subject_id: z.string().uuid(), decision: z.string().trim().min(1).max(2000), rationale: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isSteward } = await context.supabase.rpc("has_role", { _uid: context.userId, _role: "steward" } as never);
    if (!isSteward) throw err("FORBIDDEN: a steward records council engagements");
    const db = await admin();
    const r = await db.rpc("thread_create_object", {
      p_actor: { kind: "human", id: context.userId, authority_used: "act_with_confirmation" },
      p: envelope("ConfirmedDecision", `Council: ${data.decision.slice(0, 120)}`, data.decision, {
        decision: data.decision, decided_by: "governance_council", source: "governance_council", authority_used: "act_with_confirmation",
        context: data.subject_id, alternatives: [], rationale: data.rationale, reversibility: "reversible", consequences: [], effective_from: new Date().toISOString(),
      }, context.userId, { derived_from: [data.subject_id] }) as never,
    });
    if (r.error) throw err(r.error.message);
    return r.data as { id: string; human_ref: string };
  });

/** Phase 3 exit evidence: DB self-test + engine test matrix + PHI/PAN corpus recall (published as a rendition). */
export const runPhase3Evidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const e = await engine();
    const { classifyContent } = await import("@/domain/content-tier");
    const { measureRecall } = await import("@/domain/phi-pan-corpus");
    const db = await admin();
    const { data: grs } = await db.from("guardrails").select("id,category,evaluator,enforcement,params,version").eq("active", true);
    const now = new Date().toISOString();
    const refs = ["00000000-0000-0000-0000-000000000001"];
    const b = (v: number) => Object.fromEntries([...e.CONFIDENCE_DIMENSIONS.map((d) => [d, { value: v, evidence_refs: refs }]), ["owner_confidence", { value: v }]]);
    const c = (cons: string, tier: number, extra: Json = {}) => ({
      action: "release", now, object: { type: "ComposableCapability", owner_id: "o", risk_tier: tier, consequence_class: cons, data_classification: "internal" },
      actor: { kind: "agent", id: "a", authority: "act_bounded" }, grant: { level: "act_bounded", effective_to: "2999-01-01T00:00:00Z" }, ...extra,
    });
    const cells: Array<[string, Json, number, string]> = [
      ["High confidence, low consequence, encoded authority", c("none", 1), 0.9, "automatic_release"],
      ["High confidence, low consequence, no encoded authority", c("none", 1, { grant: null }), 0.9, "act_with_confirmation"],
      ["Moderate confidence, reversible", c("reversible", 1), 0.6, "limited_exposure_with_observation"],
      ["Moderate confidence, costly reversible", c("costly_reversible", 2), 0.6, "limited_exposure_with_observation"],
      ["Low confidence, low consequence (bounded actor)", c("none", 1), 0.2, "limited_exposure_with_observation"],
      ["Low confidence, low consequence (recommend actor)", c("none", 1, { actor: { kind: "agent", id: "a", authority: "recommend" } }), 0.2, "recommend"],
      ["High confidence, irreversible", c("irreversible", 3), 0.95, "explicit_human_decision"],
      ["Any confidence, rights-affecting", c("rights_affecting", 4), 0.99, "explicit_human_decision_independent"],
      ["Any confidence, safety", c("safety", 4), 0.1, "explicit_human_decision_independent"],
      ["Any confidence, prohibited condition", c("none", 1, { flags: { high_impact_tool_call_without_policy: true } }), 0.99, "cannot_proceed"],
      ["Any confidence, Tier C content", c("none", 1, { content_text: "card 4111 1111 1111 1111" }), 0.99, "hard_block"],
      ["Authority lapsed", c("none", 1, { grant: { level: "act_bounded", effective_to: "2000-01-01T00:00:00Z" } }), 0.99, "route_refused"],
    ];
    const matrix: Array<{ name: string; expected: string; got: string; pass: boolean }> = cells.map(([name, ctx, v, expected]) => {
      const got = e.evaluateAuthority(ctx as never, b(v) as never, (grs ?? []) as never).treatment;
      return { name, expected, got, pass: got === expected };
    });
    matrix.push({ name: "Version changed materially", expected: "observe", got: e.demote("act_bounded", "capability_version_changed_materially").to, pass: e.demote("act_bounded", "capability_version_changed_materially").to === "observe" });
    const phi = measureRecall(classifyContent);
    const r = await db.rpc("thread_record_phase3_evidence", {
      p_actor: human(context.userId),
      p: { matrix, matrix_passed: matrix.every((m) => m.pass), phi_pan: { ...phi, misses: phi.misses.length, measured_at: now, classifier: "ContentClassifier regex+Luhn (deterministic)" } },
    } as never);
    if (r.error) throw err(r.error.message);
    return JSON.stringify(r.data);
  });
