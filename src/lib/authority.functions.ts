/**
 * Phase 3 server functions: authority engine evaluations, the Human Decision Queue, council escalation, exit evidence.
 * The engine (src/server/authority/engine.ts) is pure and is loaded inside handlers only.
 * Every evaluation writes a PolicyEvaluation object (ledger-first via thread_create_object).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EvalInput } from "@/domain/authority-input";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Json = Record<string, unknown>;
const human = (id: string) => ({ kind: "human" as const, id, authority_used: "observe" });
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
    const { evaluateActionCore } = await import("@/server/ops/authority.server");
    return evaluateActionCore({ sb: context.supabase, db: await admin(), userId: context.userId, actor: human(context.userId) }, data, { simulateAgent: data.agent });
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
      ["Low confidence, low consequence (bounded actor)", c("none", 1), 0.2, "explicit_human_decision"],
      ["Low confidence, low consequence (recommend actor)", c("none", 1, { actor: { kind: "agent", id: "a", authority: "recommend" } }), 0.2, "explicit_human_decision"],
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
