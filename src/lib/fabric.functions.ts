/**
 * Phase 4 Capability Fabric server functions (Part 7). Discovery runs as the caller; writes go through thread_* functions.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { contractGaps, BODY_REQUIRED_KEYS, reuseDecisionError, effectiveAuthority, type Level, type ReuseResult } from "@/domain/fabric";

type Json = Record<string, unknown>;
const human = (id: string) => ({ kind: "human", id, authority_used: "observe" });
async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}
function err(message: string): Error {
  const code = message.split(":")[0]?.trim() || "ERROR";
  return new Error(JSON.stringify({ code, explanation: message }));
}
const Shape = z.object({
  outcome: z.string().trim().min(1).max(500),
  inputs: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  outputs: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  domain: z.string().trim().max(120).default(""),
});

export const listFabric = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const [caps, comps, use, checks] = await Promise.all([
      sb.from("objects").select("id,human_ref,title,statement,lifecycle_state,authority_level,risk_tier,owner_id,review_date,body,retirement_reason,updated_at")
        .eq("type", "ComposableCapability").eq("is_tombstone", false).order("updated_at", { ascending: false }).limit(200),
      sb.from("objects").select("id,human_ref,title,statement,body,authority_level").eq("type", "WorkingCapability").eq("is_tombstone", false).order("created_at", { ascending: false }).limit(50),
      sb.from("capability_usage").select("capability_id,cost,outcome,adapter_mode").gte("at", since).limit(5000),
      sb.from("reuse_checks").select("id,intent_shape,decision,rationale,results,checked_at").order("checked_at", { ascending: false }).limit(20),
    ]);
    if (caps.error) throw err(caps.error.message);
    const usage = new Map<string, { uses: number; cost: number; failures: number }>();
    for (const u of use.data ?? []) {
      const m = usage.get(u.capability_id) ?? { uses: 0, cost: 0, failures: 0 };
      m.uses++; m.cost += Number(u.cost); if (u.outcome !== "success") m.failures++;
      usage.set(u.capability_id, m);
    }
    const capRows = (caps.data ?? []).map((c) => {
      const b = c.body as Json;
      const dependants = (comps.data ?? []).filter((w) => ((w.body as Json)["capability_refs"] as string[] | undefined)?.includes(c.id)).length;
      return {
        ...c, gaps: contractGaps(b), usage: usage.get(c.id) ?? { uses: 0, cost: 0, failures: 0 },
        published: b["is_machine_discoverable"] === true,
        // 7.6: replaceability and retirement cost as first-class metadata
        retirement_cost: { dependent_compositions: dependants, dependencies: Array.isArray(b["dependencies"]) ? (b["dependencies"] as unknown[]).length : 0 },
      };
    });
    const compositions = (comps.data ?? []).map((w) => {
      const refs = ((w.body as Json)["capability_refs"] as string[] | undefined) ?? [];
      const parts = capRows.filter((c) => refs.includes(c.id));
      return { ...w, parts: parts.map((p) => ({ id: p.id, human_ref: p.human_ref, title: p.title, authority_level: p.authority_level, lifecycle_state: p.lifecycle_state })),
        effective_authority: effectiveAuthority(parts.map((p) => p.authority_level as Level)) };
    });
    return { capabilities: capRows, compositions, reuse_checks: checks.data ?? [], required_keys: BODY_REQUIRED_KEYS };
  });

export const searchCapabilityFabric = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Shape.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("fabric_search", { p_outcome: data.outcome, p_inputs: data.inputs, p_outputs: data.outputs, p_domain: data.domain, p_limit: 10 } as never);
    if (error) throw err(error.message);
    return (rows ?? []) as Array<ReuseResult & { human_ref: string; title: string; statement: string; lifecycle_state: string; authority_level: string }>;
  });

export const recordReuseCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    intent_shape: Shape,
    decision: z.enum(["reuse_as_is", "compose_existing", "create_new"]),
    rationale: z.string().trim().min(1).max(2000),
    behavior_statement_id: z.string().uuid().optional(),
    extra_gaps: z.record(z.array(z.string().trim().min(1).max(200))).default({}),
  }).parse(d))
  .handler(async ({ data, context }) => {
    // Results are recomputed on the server, never trusted from the browser.
    const { data: rows, error } = await context.supabase.rpc("fabric_search", { p_outcome: data.intent_shape.outcome, p_inputs: data.intent_shape.inputs, p_outputs: data.intent_shape.outputs, p_domain: data.intent_shape.domain, p_limit: 10 } as never);
    if (error) throw err(error.message);
    const results = ((rows ?? []) as ReuseResult[]).map((r) => ({ capability_id: r.capability_id, match_score: r.match_score, reuse_mode: r.reuse_mode, gaps: [...r.gaps, ...(data.extra_gaps[r.capability_id] ?? [])] }));
    const bad = reuseDecisionError(results, data.decision, data.rationale);
    if (bad) throw err(bad);
    if (data.behavior_statement_id) {
      const { data: bs } = await context.supabase.from("objects").select("type").eq("id", data.behavior_statement_id).maybeSingle();
      if (bs?.type !== "BehaviorStatement") throw err("NOT_A_BEHAVIOR_STATEMENT: the reuse check links to the originating Behaviour Statement");
    }
    const db = await admin();
    const id = crypto.randomUUID();
    const { error: e2 } = await db.from("reuse_checks").insert({
      id, intent_shape: data.intent_shape, query_text: `${data.intent_shape.outcome} ${data.intent_shape.domain}`.trim(), results, decision: data.decision,
      rationale: data.rationale, checked_by: human(context.userId), behavior_statement_id: data.behavior_statement_id ?? null,
    } as never);
    if (e2) throw err(e2.message);
    return { reuse_check_id: id, results };
  });

const CapInput = z.object({
  title: z.string().trim().min(1).max(200),
  statement: z.string().trim().min(1).max(4000),
  machine_description: z.string().trim().min(1).max(2000),
  body: z.record(z.unknown()),
  risk_tier: z.enum(["1", "2", "3", "4"]),
  consequence_class: z.enum(["none", "reversible", "costly_reversible", "irreversible", "rights_affecting", "safety", "lifeline"]),
  data_classification: z.enum(["public", "internal", "confidential", "restricted"]),
  review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const createCapability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CapInput.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const b = { ...data.body, is_machine_discoverable: false };
    const { data: row, error } = await db.rpc("thread_create_object", { p_actor: human(context.userId), p: {
      type: "ComposableCapability", title: data.title, statement: data.statement, machine_description: data.machine_description, body: b,
      review_date: data.review_date, expiration_condition: { kind: "min_use_below_threshold", params: (b["minimum_use_threshold"] as Json) ?? {} },
      retirement_path: { mode: "archive_evidence" }, risk_tier: data.risk_tier, consequence_class: data.consequence_class,
      permission: { roles: [], purpose: "capability fabric" }, data_classification: data.data_classification, owner_id: context.userId,
      rationale: "Capability recorded in the fabric (7.6)",
    } as never });
    if (error) throw err(error.message);
    return row as { id: string; human_ref: string };
  });

export const updateCapabilityBody = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), expected_version: z.number().int().positive(), body: z.record(z.unknown()) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: cur } = await db.from("objects").select("body,type").eq("id", data.id).single();
    if (cur?.type !== "ComposableCapability") throw err("NOT_A_CAPABILITY");
    const merged = { ...(cur.body as Json), ...data.body, is_machine_discoverable: (cur.body as Json)["is_machine_discoverable"] ?? false };
    const { error } = await db.rpc("thread_revise_object", { p_actor: human(context.userId), p_id: data.id, p_expected_version: data.expected_version, p_patch: { body: merged }, p_rationale: "capability contract fields updated" } as never);
    if (error) throw err(error.message);
    return { ok: true };
  });

export const publishReusableCapability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ capability_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const actor = human(context.userId);
    const { data: cap } = await db.from("objects").select("id,human_ref,title,body,owner_id").eq("id", data.capability_id).single();
    if (!cap) throw err("NOT_FOUND");
    const b = cap.body as Json;
    const gaps = contractGaps(b);
    if (gaps.length) throw err(`CONTRACT_INCOMPLETE: missing ${gaps.join(", ")}`);
    let contractId = b["contract_ref"] as string | undefined;
    if (!contractId) {
      const k = await db.rpc("thread_create_object", { p_actor: actor, p: {
        type: "CapabilityContract", title: `Contract: ${cap.title}`, statement: String(b["business_outcome"]),
        machine_description: `Capability Contract for ${cap.human_ref}`,
        body: { promised_outcome: b["business_outcome"], refusal_conditions: b["human_intervention_conditions"], explanation_obligations: b["explainability_audit_behaviour"],
          evidence_obligations: b["confidence_requirements"], authority: "inherited from the capability", cost_model: b["operating_cost_ceiling"],
          lifecycle: { minimum_use_threshold: b["minimum_use_threshold"], retirement_condition: b["retirement_condition"] } },
        review_date: new Date(Date.now() + 180 * 864e5).toISOString().slice(0, 10), expiration_condition: { kind: "review_date_passes" },
        retirement_path: { mode: "supersede" }, risk_tier: "1", permission: { roles: [], purpose: "capability contract" }, data_classification: "internal",
        owner_id: cap.owner_id, rationale: "Contract published with the capability (7.2)",
      } as never });
      if (k.error) throw err(k.error.message);
      contractId = (k.data as { id: string }).id;
    }
    const { data: row, error } = await db.rpc("thread_publish_capability", { p_actor: actor, p_id: cap.id, p_contract_id: contractId } as never);
    if (error) throw err(error.message);
    return row as { id: string; human_ref: string; lifecycle_state: string };
  });

export const composeCapabilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string().uuid()).min(2).max(20), title: z.string().trim().min(1).max(200), scenario: z.string().trim().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: r, error } = await db.rpc("thread_compose_capabilities", { p_actor: human(context.userId), p_ids: data.ids, p_title: data.title, p_scenario: data.scenario } as never);
    if (error) throw err(error.message);
    return r as { composition_id: string; human_ref: string; effective_authority: string };
  });

export const recordCapabilityUse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ capability_id: z.string().uuid(), outcome: z.enum(["success", "failure", "refused", "escalated"]), cost: z.number().min(0).max(1e6) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    // Telemetry adapter is simulated until a live Telemetry binding exists (Phase 7).
    const { data: id, error } = await db.rpc("thread_record_capability_use", { p_actor: human(context.userId), p_id: data.capability_id,
      p: { consumer: context.userId, outcome: data.outcome, cost: data.cost, adapter_mode: "simulated" } } as never);
    if (error) throw err(error.message);
    return { id };
  });

export const runFabricSweep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isSteward } = await context.supabase.rpc("has_role", { _uid: context.userId, _role: "steward" } as never);
    if (!isSteward) throw err("FORBIDDEN: a steward runs the lifecycle sweep");
    const db = await admin();
    const { data, error } = await db.rpc("thread_fabric_sweep", { p_actor: { kind: "system", id: context.userId, authority_used: "observe", engine: "fabric.sweep" } } as never);
    if (error) throw err(error.message);
    return JSON.stringify(data);
  });

export const runPhase4Evidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { data, error } = await db.rpc("thread_record_phase4_evidence", { p_actor: human(context.userId), p: { surface: "fabric" } } as never);
    if (error) throw err(error.message);
    return JSON.stringify(data);
  });
