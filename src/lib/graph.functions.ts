import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SUBGRAPH_VIEWS } from "@/domain/graph-views";
import { ORIGINS, DEPENDENCY_KINDS } from "@/domain/relationships";

// Actor comes from the verified session, never from client input.
function humanActor(userId: string, authority_used = "observe") {
  return { kind: "human", id: userId, authority_used };
}
function toThreadError(message: string): Error {
  const code = message.split(":")[0]?.trim() || "ERROR";
  return new Error(JSON.stringify({ code, explanation: message }));
}
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
/** Keeps the precomputed layout and graph-integrity findings current after a write (best effort). */
async function maintain(userId: string) {
  const db = await admin();
  await db.rpc("thread_refresh_graph_layout");
  await db.rpc("thread_graph_sweep", { p_actor: humanActor(userId) });
}

const uuid = z.string().uuid();

export interface GraphNode {
  id: string; ref: string; type: string; title: string; statement?: string; state: string; version: number; family: string;
  authority_level: string; risk_tier: string; review_date: string; expires_at: string | null; owner_id: string; steward_id: string | null;
  tombstone: boolean; open_findings: number; depth?: number; x?: number; y?: number; cluster?: string;
}
export interface GraphEdge {
  id: string; verb: string; from: string; to: string; source: string; kind: string | null; confidence: number | null;
  authority_used: string; evidence_refs: string[]; created_by: { kind: string; id: string }; created_at: string; rationale: string | null;
}
export interface Subgraph { nodes: GraphNode[]; edges: GraphEdge[]; total_edges: number; edge_budget: number; total_nodes?: number; node_budget?: number }

export const getNeighbourhood = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { root: string; depth?: number; budget?: number }) => z.object({ root: uuid, depth: z.number().int().min(1).max(3).optional(), budget: z.number().int().min(1).max(2000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("graph_neighbourhood", { p_root: data.root, p_depth: data.depth ?? 2, p_edge_budget: data.budget ?? 500 });
    if (error) throw new Error(error.message);
    return r as unknown as Subgraph;
  });

export const getPaths = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from: string; to: string; maxDepth?: number }) => z.object({ from: uuid, to: uuid, maxDepth: z.number().int().min(1).max(6).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("graph_paths", { p_from: data.from, p_to: data.to, p_max_depth: data.maxDepth ?? 4, p_limit: 10 });
    if (error) throw new Error(error.message);
    return r as unknown as { paths: { nodes: string[]; edges: string[]; length: number }[]; shortest: number | null; max_depth: number; nodes: GraphNode[]; edges: GraphEdge[] };
  });

export const getClosure = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { root: string; depth?: number }) => z.object({ root: uuid, depth: z.number().int().min(1).max(6).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const [c, rootQ] = await Promise.all([
      context.supabase.rpc("graph_closure", { p_root: data.root, p_depth: data.depth ?? 6 }),
      context.supabase.rpc("graph_neighbourhood", { p_root: data.root, p_depth: 1, p_edge_budget: 1 }),
    ]);
    if (c.error) throw new Error(c.error.message);
    if (rootQ.error) throw new Error(rootQ.error.message);
    const root = ((rootQ.data as unknown as Subgraph | null)?.nodes ?? []).find((n) => n.id === data.root);
    return { ...(c.data as unknown as { count: number; depth: number; nodes: GraphNode[]; edges: GraphEdge[]; by_type: Record<string, number>; by_owner: Record<string, number> }), rootNode: root ?? null };
  });

export const getSubgraph = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { view: string; nodeBudget?: number; edgeBudget?: number }) =>
    z.object({ view: z.enum(["navigator", "need_web", "dependency_web", "decomposition"]), nodeBudget: z.number().int().min(1).max(20000).optional(), edgeBudget: z.number().int().min(1).max(20000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const v = SUBGRAPH_VIEWS[data.view];
    const { data: r, error } = await context.supabase.rpc("graph_subgraph", {
      p_types: [...v.types], p_verbs: [...v.verbs], p_node_budget: data.nodeBudget ?? 2000, p_edge_budget: data.edgeBudget ?? 2000,
    });
    if (error) throw new Error(error.message);
    return r as unknown as Subgraph;
  });

export const getContradictions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("graph_contradictions");
    if (error) throw new Error(error.message);
    type Side = { id: string; ref: string; type: string; title: string; statement: string };
    return (data ?? []) as unknown as { edge: GraphEdge; subject: string; a: Side; b: Side }[];
  });

export const getNebula = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cluster?: string | undefined; nodeBudget?: number; edgeBudget?: number }) =>
    z.object({ cluster: z.string().max(80).optional(), nodeBudget: z.number().int().min(1).max(20000).optional(), edgeBudget: z.number().int().min(1).max(20000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("graph_nebula", {
      p_cluster: data.cluster ?? undefined, p_node_budget: data.nodeBudget ?? 20000, p_edge_budget: data.edgeBudget ?? 5000,
    } as never);
    if (error) throw new Error(error.message);
    return r as unknown as
      | { level: "clusters"; clusters: { cluster: string; count: number; x: number; y: number }[]; links: { from: string; to: string; count: number }[]; computed_at: string | null }
      | ({ level: "nodes"; cluster: string } & Subgraph);
  });

export const getIntegrity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [orph, cyc, drift] = await Promise.all([
      context.supabase.rpc("graph_orphans", { p_limit: 200 }),
      context.supabase.rpc("graph_cycles", {}),
      context.supabase.rpc("canon_drift_report"),
    ]);
    if (orph.error) throw new Error(orph.error.message);
    return {
      orphans: orph.data as unknown as { count: number; live_objects: number; nodes: GraphNode[] },
      cycles: (cyc.data ?? []) as unknown as { verb: string; path: string[]; refs: string[] }[],
      drift: drift.data as unknown as {
        canon_objects: number; active: number; content_changes: number; via_change_path: number; drift_rate: number;
        silent_changes: { id: string; ref: string; version: number }[]; hash_mismatches: string[];
        without_steward: { id: string; ref: string }[]; review_overdue: { id: string; ref: string; review_date: string }[]; open_changes: number; computed_at: string;
      },
    };
  });

export const getVerbs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("relationship_verbs").select("verb,signatures,directed,impact,computed,acyclic").order("verb");
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as { verb: string; signatures: { from: string[]; to: string[] }[]; directed: boolean; impact: string; computed: boolean; acyclic: boolean }[];
  });

export const getObjectEdges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("graph_neighbourhood", { p_root: data.id, p_depth: 1, p_edge_budget: 500 });
    if (error) throw new Error(error.message);
    return r as unknown as Subgraph;
  });

export const createEdge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    verb: z.string().min(1).max(60), from_id: uuid, to_id: uuid,
    source: z.enum(ORIGINS as [string, ...string[]]).default("stated"),
    kind: z.enum(DEPENDENCY_KINDS).optional(),
    confidence: z.number().min(0).max(1).optional(),
    rationale: z.string().trim().min(1).max(1000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: e, error } = await db.rpc("thread_create_edge", { p_actor: humanActor(context.userId), p: data as never });
    if (error) throw toThreadError(error.message);
    await maintain(context.userId).catch(() => undefined);
    return { id: (e as { id: string }).id };
  });

export const retireEdge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid, reason: z.string().trim().min(1).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { error } = await db.rpc("thread_retire_edge", { p_actor: humanActor(context.userId), p_edge_id: data.id, p_reason: data.reason });
    if (error) throw toThreadError(error.message);
    await maintain(context.userId).catch(() => undefined);
    return { ok: true };
  });

export const runGraphSweep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    await db.rpc("thread_refresh_graph_layout");
    const { data, error } = await db.rpc("thread_graph_sweep", { p_actor: humanActor(context.userId) });
    if (error) throw toThreadError(error.message);
    return data as unknown as Record<string, number>;
  });

// ---- Canon change workflow (Part 10.5, P15) ----

export const getCanonChanges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { objectId: string }) => z.object({ objectId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ch, error } = await context.supabase.from("canon_changes")
      .select("id,base_version,patch,rationale,evidence_refs,proposed_by,proposed_at,challenge_closes_at,state,decided_by,decided_at,decision_rationale,decision_object_id,applied_version")
      .eq("object_id", data.objectId).order("proposed_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (ch ?? []).map((c) => c.id);
    const evIds = [...new Set((ch ?? []).flatMap((c) => c.evidence_refs ?? []))];
    const [chal, ev] = await Promise.all([
      ids.length ? context.supabase.from("canon_challenges").select("id,change_id,origin,argument,created_at").in("change_id", ids).order("created_at") : Promise.resolve({ data: [] as never[] }),
      evIds.length ? context.supabase.from("objects").select("id,human_ref,title").in("id", evIds) : Promise.resolve({ data: [] as never[] }),
    ]);
    const refs = new Map(((ev.data ?? []) as { id: string; human_ref: string; title: string }[]).map((o) => [o.id, o]));
    return (ch ?? []).map((c) => ({
      ...c,
      evidence: (c.evidence_refs ?? []).map((id: string) => refs.get(id) ?? { id, human_ref: id.slice(0, 8), title: "not visible" }),
      challenges: ((chal.data ?? []) as { id: string; change_id: string; origin: string; argument: string; created_at: string }[]).filter((x) => x.change_id === c.id),
    }));
  });

const PatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  statement: z.string().trim().min(1).max(4000).optional(),
  machine_description: z.string().trim().min(1).max(2000).optional(),
}).refine((p) => Object.keys(p).length > 0, "State what changes");

export const proposeCanonChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    object_id: uuid, base_version: z.number().int().positive(), patch: PatchSchema,
    rationale: z.string().trim().min(1).max(1000),
    evidence: z.array(z.string().trim().min(1).max(60)).min(1, "Cite at least one evidence object").max(20),
    challenge_hours: z.number().int().min(24).max(24 * 30).default(72),
  }).parse(d))
  .handler(async ({ data, context }) => {
    // Evidence may be given as human refs (e.g. TR-2026-0004) or ids; resolve under the caller's permissions.
    const asIds = data.evidence.filter((e) => uuid.safeParse(e).success);
    const asRefs = data.evidence.filter((e) => !uuid.safeParse(e).success).map((e) => e.toUpperCase());
    const { data: found } = asRefs.length ? await context.supabase.from("objects").select("id,human_ref").in("human_ref", asRefs) : { data: [] as { id: string; human_ref: string }[] };
    const missing = asRefs.filter((r) => !(found ?? []).some((f) => f.human_ref === r));
    if (missing.length) throw toThreadError(`EVIDENCE_NOT_FOUND: ${missing.join(", ")}`);
    const db = await admin();
    const { data: c, error } = await db.rpc("thread_propose_canon_change", {
      p_actor: humanActor(context.userId, "recommend"),
      p: { object_id: data.object_id, base_version: data.base_version, patch: data.patch, rationale: data.rationale,
        evidence_refs: [...asIds, ...(found ?? []).map((f) => f.id)], challenge_hours: data.challenge_hours } as never,
    });
    if (error) throw toThreadError(error.message);
    return { id: (c as { id: string }).id };
  });

export const addCanonChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ change_id: uuid, argument: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { error } = await db.rpc("thread_add_canon_challenge", { p_actor: humanActor(context.userId), p_change_id: data.change_id, p_argument: data.argument, p_evidence_refs: [] });
    if (error) throw toThreadError(error.message);
    return { ok: true };
  });

export const decideCanonChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ change_id: uuid, decision: z.enum(["accept", "reject"]), rationale: z.string().trim().min(1).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: r, error } = await db.rpc("thread_decide_canon_change", {
      p_actor: humanActor(context.userId, "act_with_confirmation"), p_change_id: data.change_id, p_decision: data.decision, p_rationale: data.rationale,
    });
    if (error) throw toThreadError(error.message);
    await maintain(context.userId).catch(() => undefined);
    return r as unknown as { decision_ref: string; new_version: number | null; owners_notified: number };
  });

// ---- Phase 2 exit evidence ----

export const recordRenderBenchmark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    dataset: z.enum(["synthetic", "canon"]), nodes: z.number().int().min(1), edges_rendered: z.number().int().min(0), edges_total: z.number().int().min(0),
    fps_median: z.number().min(0), fps_p5: z.number().min(0), duration_ms: z.number().min(0), first_paint_ms: z.number().min(0),
    user_agent: z.string().max(400), device_pixel_ratio: z.number().min(0),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: seq, error } = await db.rpc("thread_record_render_benchmark", { p_actor: humanActor(context.userId), p: data as never });
    if (error) throw toThreadError(error.message);
    return { seq: seq as number };
  });

export const getPhase2Evidence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("ledger").select("seq,occurred_at,payload,hash")
      .eq("action", "phase2.exit_evidence").order("seq", { ascending: false }).limit(1).maybeSingle();
    return data;
  });

export const runPhase2Evidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { data, error } = await db.rpc("thread_record_phase2_evidence", { p_actor: humanActor(context.userId) });
    if (error) throw toThreadError(error.message);
    return data;
  });
