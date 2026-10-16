/**
 * Phase 6 creation loop server functions (Part 8). Reads run as the caller; writes go through thread_* functions
 * with the actor taken from the verified session. Dispatch always goes through the BuildPlatform adapter.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { compileCreationPrompt, platformRefusal, PLATFORMS, type Platform, type Classification } from "@/domain/creation";

type Json = Record<string, unknown>;
const human = (id: string) => ({ kind: "human", id, authority_used: "observe" });
async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}
function err(message: string): Error {
  const code = message.split(":")[0]?.trim() || "ERROR";
  return new Error(JSON.stringify({ code, explanation: message }));
}
async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export const listCreation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const sel = "id,human_ref,title,statement,lifecycle_state,data_classification,body,created_at";
    const [bs, eo, tp, rc, cp, prompts, runs, br, its, plats, finds, ms] = await Promise.all([
      sb.from("objects").select(sel).eq("type", "BehaviorStatement").eq("is_tombstone", false).in("lifecycle_state", ["confirmed", "generating", "verified_in_simulation", "verified_in_shadow", "verified_in_production"]).limit(200),
      sb.from("objects").select(sel).eq("type", "ExecutableOutcomeContract").eq("is_tombstone", false).eq("lifecycle_state", "active").limit(100),
      sb.from("objects").select(sel).eq("type", "PromptTemplate").eq("is_tombstone", false).limit(100),
      sb.from("reuse_checks").select("id,intent_shape,decision,behavior_statement_id,checked_at").not("behavior_statement_id", "is", null).order("checked_at", { ascending: false }).limit(100),
      sb.from("creation_prompts").select("object_id,reuse_check_id,source_behavior_ids,template_version,compiled_text,compiled_hash").limit(200),
      sb.from("objects").select("id,human_ref,title,lifecycle_state,data_classification,body,created_at").eq("type", "CreationPrompt").eq("is_tombstone", false).order("created_at", { ascending: false }).limit(100),
      sb.from("objects").select("id,human_ref,title,lifecycle_state,created_at").eq("type", "BuildRun").order("created_at", { ascending: false }).limit(200),
      sb.from("build_runs").select("*").limit(500),
      sb.from("iterations").select("*").order("at", { ascending: false }).limit(50),
      sb.from("build_platforms").select("*"),
      sb.from("detector_findings").select("id,object_id,severity,state,evidence,created_at").eq("detector_key", "ScopeChangeSmuggledThroughIteration").order("created_at", { ascending: false }).limit(50),
      sb.from("objects").select("id,human_ref,title").eq("type", "ValueMission").eq("is_tombstone", false).limit(100),
    ]);
    if (bs.error) throw err(bs.error.message);
    const cpBy = new Map((cp.data ?? []).map((c) => [c.object_id, c]));
    const brBy = new Map((br.data ?? []).map((r) => [r.object_id, r]));
    return {
      behaviors: bs.data ?? [], contracts: eo.data ?? [], templates: tp.data ?? [], reuse_checks: rc.data ?? [], missions: ms.data ?? [],
      prompts: (prompts.data ?? []).map((p) => ({ ...p, compiled: cpBy.get(p.id) ?? null })),
      runs: (runs.data ?? []).filter((r) => brBy.has(r.id)).map((r) => ({ ...r, run: brBy.get(r.id)! })),
      iterations: its.data ?? [], platforms: plats.data ?? [], findings: finds.data ?? [],
    };
  });

export const compilePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    behavior_ids: z.array(z.string().uuid()).min(1).max(20),
    contract_id: z.string().uuid(), template_id: z.string().uuid(), reuse_check_id: z.string().uuid(),
    target_platform: z.enum(PLATFORMS), mission_ref: z.string().uuid().optional(),
    estimated_cost: z.number().min(0).max(100000).default(0),
    quoted_reference: z.string().max(280).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const ids = [...data.behavior_ids, data.contract_id, data.template_id];
    const [objs, gr, rc] = await Promise.all([
      sb.from("objects").select("id,human_ref,title,type,body,data_classification").in("id", ids),
      sb.from("guardrails").select("id,category,version,enforcement").eq("active", true),
      sb.from("reuse_checks").select("results,decision").eq("id", data.reuse_check_id).maybeSingle(),
    ]);
    if (objs.error) throw err(objs.error.message);
    const by = new Map((objs.data ?? []).map((o) => [o.id, o]));
    const con = by.get(data.contract_id); const tpl = by.get(data.template_id);
    if (!con || !tpl) throw err("NOT_FOUND: contract or template not visible to you");
    // Part 13.4: only these typed fields are read; transcripts, raw_text, spans and quotes never are
    const behaviors = data.behavior_ids.map((id) => {
      const o = by.get(id); if (!o) throw err(`NOT_FOUND: ${id}`);
      const b = o.body as Json;
      return { id, human_ref: o.human_ref, condition: String(b["condition"] ?? ""), observable_result: String(b["observable_result"] ?? ""), operating_constraints: strs(b["operating_constraints"]) };
    });
    const cb = con.body as Json; const tb = tpl.body as Json;
    const capRefs = ((rc.data?.results as Array<{ capability_id?: string; human_ref?: string; title?: string }> | null) ?? [])
      .filter(() => rc.data?.decision !== "create_new").filter((r) => r.capability_id);
    const compiled = compileCreationPrompt({
      behaviors,
      contract: { id: con.id, human_ref: con.human_ref, desired_outcome: String(cb["desired_outcome"] ?? con.title), non_negotiables: strs(cb["non_negotiables"]), acceptance_evidence: strs(cb["acceptance_evidence"]) },
      template: { id: tpl.id, human_ref: tpl.human_ref, version: String(tb["version"] ?? "1"), stack: String(tb["stack"] ?? ""), instructions: String(tb["instructions"] ?? "") },
      guardrails: (gr.data ?? []).map((g) => ({ id: g.id, category: g.category, version: g.version, enforcement: g.enforcement as "advisory" | "enforcing" })),
      capabilities: capRefs.map((c) => ({ id: c.capability_id!, human_ref: c.human_ref ?? c.capability_id!, title: c.title ?? "" })),
      platform: data.target_platform, ...(data.quoted_reference ? { quoted_reference: data.quoted_reference } : {}),
    });
    const { data: o, error } = await (await admin()).rpc("thread_compile_creation_prompt", {
      p_actor: human(context.userId),
      p: { behavior_ids: data.behavior_ids, contract_id: data.contract_id, template_id: data.template_id, reuse_check_id: data.reuse_check_id,
        target_platform: data.target_platform, title: `Build ${behaviors.map((b) => b.human_ref).join(", ")}`, compiled_text: compiled.text,
        compiled_hash: await sha256(compiled.text), guardrails_applied: compiled.guardrails_applied, capability_refs: capRefs.map((c) => c.capability_id),
        mission_ref: data.mission_ref, estimated_cost: data.estimated_cost },
    } as never);
    if (error) throw err(error.message);
    return o as unknown as { id: string; human_ref: string };
  });

async function runOnPlatform(userId: string, p: { prompt_id: string; platform: Platform; cost_ceiling: number; estimated_cost: number; replay_of?: string }) {
  const sb = await admin();
  const [{ data: prompt }, { data: cp }, { data: binding }] = await Promise.all([
    sb.from("objects").select("data_classification").eq("id", p.prompt_id).single(),
    sb.from("creation_prompts").select("compiled_text,compiled_hash,template_version").eq("object_id", p.prompt_id).single(),
    sb.from("adapter_bindings").select("mode").eq("adapter", "BuildPlatform").eq("environment", "preview").maybeSingle(),
  ]);
  if (!prompt || !cp) throw err("PROMPT_REQUIRED: compile the prompt first");
  const refused = platformRefusal(p.platform, prompt.data_classification as Classification);
  if (refused) throw err(refused);
  const { liveConfig, liveBuildPlatform } = await import("@/server/adapters/build-platform/live");
  const { simulatedBuildPlatform } = await import("@/server/adapters/build-platform/simulated");
  const cfg = binding?.mode === "live" ? liveConfig(p.platform) : null;
  const adapter = cfg ? liveBuildPlatform(p.platform, cfg) : simulatedBuildPlatform();
  const model_version = adapter.mode === "simulated" ? "sim-1" : (process.env[`BUILD_PLATFORM_${p.platform.toUpperCase()}_MODEL`] ?? "unpinned");
  const actor = human(userId);
  // ceilings, clearance and the reproducibility key are checked by the database BEFORE anything leaves THREAD
  const d = await sb.rpc("thread_dispatch_build", { p_actor: actor, p: { ...p, model_version, adapter_mode: adapter.mode } } as never);
  if (d.error) throw err(d.error.message);
  const disp = d.data as unknown as { run_id: string; human_ref: string; repro_key: { model_version: string; template_version: string; guardrail_set_version: string } };
  let result: Json;
  try {
    const { external_run_id } = await adapter.dispatch({ platform: p.platform, prompt_id: p.prompt_id, compiled_prompt: cp.compiled_text, compiled_hash: cp.compiled_hash, repro_key: disp.repro_key, cost_ceiling: p.cost_ceiling });
    if (adapter.mode === "live") return { run_id: disp.run_id, human_ref: disp.human_ref, status: "dispatched", note: "results arrive by signed webhook" };
    const st = await adapter.status(external_run_id);
    const artifacts = st.state === "succeeded" ? await adapter.fetchArtifacts(external_run_id) : [];
    const r = await sb.rpc("thread_record_build_result", { p_actor: actor, p: { run_id: disp.run_id, external_run_id, status: st.state === "succeeded" ? "succeeded" : "failed",
      cost_actual: st.cost, duration_ms: st.duration_ms, secrets_scan: st.secrets_scan, failure_reason: st.failure_reason, artifacts } } as never);
    if (r.error) throw err(r.error.message);
    result = r.data as Json;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.rpc("thread_record_build_result", { p_actor: actor, p: { run_id: disp.run_id, status: "failed", failure_reason: msg.slice(0, 500) } } as never);
    throw e;
  }
  return { ...result, human_ref: disp.human_ref };
}

export const dispatchBuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    prompt_id: z.string().uuid(), platforms: z.array(z.enum(PLATFORMS)).min(1).max(5),
    cost_ceiling: z.number().positive().max(100000), estimated_cost: z.number().min(0).max(100000).default(0),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const out: Array<{ platform: Platform; ok: boolean; result: Json | null; error: string | null }> = [];
    for (const platform of data.platforms) {
      try { out.push({ platform, ok: true, error: null, result: await runOnPlatform(context.userId, { prompt_id: data.prompt_id, platform, cost_ceiling: data.cost_ceiling, estimated_cost: data.estimated_cost }) }); }
      catch (e) { out.push({ platform, ok: false, result: null, error: e instanceof Error ? e.message : String(e) }); }
    }
    return out;
  });

export const replayBuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ run_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r } = await context.supabase.from("build_runs").select("prompt_id,platform,cost_ceiling").eq("object_id", data.run_id).single();
    if (!r) throw err("RUN_NOT_FOUND");
    return runOnPlatform(context.userId, { prompt_id: r.prompt_id, platform: r.platform as Platform, cost_ceiling: Number(r.cost_ceiling), estimated_cost: 0, replay_of: data.run_id });
  });

export const recordIteration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    from_run: z.string().uuid(), to_run: z.string().uuid(), declared_class: z.enum(["cosmetic", "behavioural", "scope", "architecture"]),
    trigger: z.string().trim().max(300).optional(),
    diff: z.object({ added_obligations: z.array(z.string().trim().min(1).max(300)).max(20), changed_results: z.array(z.string().trim().min(1).max(300)).max(20),
      changed_contracts: z.array(z.string().trim().min(1).max(300)).max(20), text_edits: z.array(z.string().trim().min(1).max(300)).max(20) }),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await (await admin()).rpc("thread_record_iteration", { p_actor: human(context.userId), p: data } as never);
    if (error) throw err(error.message);
    return r as unknown as { human_ref: string; classification: string; detected_class: string; scope_change_flag: boolean; governance: string };
  });

export const recordSkeleton = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ run_id: z.string().uuid(), mission_ref: z.string().uuid().optional(), one_real_user_process: z.string().trim().min(1).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await (await admin()).rpc("thread_record_skeleton", { p_actor: human(context.userId), p: data } as never);
    if (error) throw err(error.message);
    return r as unknown as { human_ref: string };
  });

export const setCostCeiling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ scope: z.enum(["mission", "cell"]), scope_id: z.string().uuid(), ceiling: z.number().positive().max(10000000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (await admin()).rpc("thread_set_cost_ceiling", { p_actor: human(context.userId), p: data } as never);
    if (error) throw err(error.message);
    return { ok: true };
  });

export const recordPhase6Evidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (await admin()).rpc("thread_record_phase6_evidence", { p_actor: human(context.userId), p: { surface: "creation" } } as never);
    if (error) throw err(error.message);
    return data as unknown as { ledger_seq: number; live_builds: string; selftest: { passed: boolean; checks: { name: string; pass: boolean; detail: string }[] } };
  });
