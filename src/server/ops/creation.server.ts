/** Creation loop cores (Part 8 / 13.4), shared by the Creation page and the MCP gateway. */
import {
  compileCreationPrompt,
  platformRefusal,
  type Platform,
  type Classification,
} from "@/domain/creation";
import { opErr as err, sha256, type Json, type OpCtx } from "./context";

const strs = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export interface CompileInput {
  behavior_ids: string[];
  contract_id: string;
  template_id: string;
  reuse_check_id: string;
  target_platform: Platform;
  mission_ref?: string | undefined;
  estimated_cost: number;
  quoted_reference?: string | undefined;
}

export async function compilePromptCore(ctx: OpCtx, data: CompileInput) {
  const sb = ctx.sb;
  const ids = [...data.behavior_ids, data.contract_id, data.template_id];
  const [objs, gr, rc] = await Promise.all([
    sb.from("objects").select("id,human_ref,title,type,body,data_classification").in("id", ids),
    sb.from("guardrails").select("id,category,version,enforcement").eq("active", true),
    sb.from("reuse_checks").select("results,decision").eq("id", data.reuse_check_id).maybeSingle(),
  ]);
  if (objs.error) throw err(objs.error.message);
  if (gr.error) throw err(`GUARDRAIL_READ_FAILED: ${gr.error.message}`);
  if (rc.error) throw err(`REUSE_CHECK_READ_FAILED: ${rc.error.message}`);
  if (!rc.data) throw err("REUSE_CHECK_REQUIRED: reuse check not visible to you");
  const by = new Map((objs.data ?? []).map((o) => [o.id, o]));
  const con = by.get(data.contract_id);
  const tpl = by.get(data.template_id);
  if (!con || !tpl) throw err("NOT_FOUND: contract or template not visible to you");
  // Part 13.4: only these typed fields are read; transcripts, raw_text, spans and quotes never are
  const behaviors = data.behavior_ids.map((id) => {
    const o = by.get(id);
    if (!o) throw err(`NOT_FOUND: ${id}`);
    const b = o.body as Json;
    return {
      id,
      human_ref: o.human_ref,
      condition: String(b["condition"] ?? ""),
      observable_result: String(b["observable_result"] ?? ""),
      operating_constraints: strs(b["operating_constraints"]),
    };
  });
  const cb = con.body as Json;
  const tb = tpl.body as Json;
  const capRefs = (
    (rc.data?.results as Array<{
      capability_id?: string;
      human_ref?: string;
      title?: string;
    }> | null) ?? []
  )
    .filter(() => rc.data?.decision !== "create_new")
    .filter((r) => r.capability_id);
  const compiled = compileCreationPrompt({
    behaviors,
    contract: {
      id: con.id,
      human_ref: con.human_ref,
      desired_outcome: String(cb["desired_outcome"] ?? con.title),
      non_negotiables: strs(cb["non_negotiables"]),
      acceptance_evidence: strs(cb["acceptance_evidence"]),
    },
    template: {
      id: tpl.id,
      human_ref: tpl.human_ref,
      version: String(tb["version"] ?? "1"),
      stack: String(tb["stack"] ?? ""),
      instructions: String(tb["instructions"] ?? ""),
    },
    guardrails: (gr.data ?? []).map((g) => ({
      id: g.id,
      category: g.category,
      version: g.version,
      enforcement: g.enforcement as "advisory" | "enforcing",
    })),
    capabilities: capRefs.flatMap((c) =>
      c.capability_id
        ? [{ id: c.capability_id, human_ref: c.human_ref ?? c.capability_id, title: c.title ?? "" }]
        : [],
    ),
    platform: data.target_platform,
    ...(data.quoted_reference ? { quoted_reference: data.quoted_reference } : {}),
  });
  const { data: o, error } = await ctx.db.rpc("thread_compile_creation_prompt", {
    p_actor: ctx.actor,
    p: {
      behavior_ids: data.behavior_ids,
      contract_id: data.contract_id,
      template_id: data.template_id,
      reuse_check_id: data.reuse_check_id,
      target_platform: data.target_platform,
      title: `Build ${behaviors.map((b) => b.human_ref).join(", ")}`,
      compiled_text: compiled.text,
      compiled_hash: await sha256(compiled.text),
      guardrails_applied: compiled.guardrails_applied,
      capability_refs: capRefs.map((c) => c.capability_id),
      mission_ref: data.mission_ref,
      estimated_cost: data.estimated_cost,
    },
  } as never);
  if (error) throw err(error.message);
  return o as unknown as { id: string; human_ref: string };
}

export async function dispatchCore(
  ctx: OpCtx,
  p: {
    prompt_id: string;
    platform: Platform;
    cost_ceiling: number;
    estimated_cost: number;
    replay_of?: string;
  },
) {
  const sb = ctx.db;
  // The prompt must be visible to the caller before anything else happens.
  const { data: visible, error: visibilityError } = await ctx.sb
    .from("objects")
    .select("id")
    .eq("id", p.prompt_id)
    .maybeSingle();
  if (visibilityError) throw err(`PROMPT_READ_FAILED: ${visibilityError.message}`);
  if (!visible) throw err("NOT_FOUND: prompt not visible to you");
  const [promptRead, compiledRead, bindingRead] = await Promise.all([
    sb.from("objects").select("data_classification").eq("id", p.prompt_id).single(),
    sb
      .from("creation_prompts")
      .select("compiled_text,compiled_hash,template_version")
      .eq("object_id", p.prompt_id)
      .single(),
    sb
      .from("adapter_bindings")
      .select("mode")
      .eq("adapter", "BuildPlatform")
      .eq("environment", "preview")
      .maybeSingle(),
  ]);
  if (promptRead.error) throw err(`PROMPT_READ_FAILED: ${promptRead.error.message}`);
  if (compiledRead.error) throw err(`PROMPT_READ_FAILED: ${compiledRead.error.message}`);
  if (bindingRead.error) throw err(`ADAPTER_BINDING_READ_FAILED: ${bindingRead.error.message}`);
  const prompt = promptRead.data;
  const cp = compiledRead.data;
  const binding = bindingRead.data;
  if (!prompt || !cp) throw err("PROMPT_REQUIRED: compile the prompt first");
  const refused = platformRefusal(p.platform, prompt.data_classification as Classification);
  if (refused) throw err(refused);
  const { liveConfig, liveBuildPlatform } = await import("@/server/adapters/build-platform/live");
  const { simulatedBuildPlatform } = await import("@/server/adapters/build-platform/simulated");
  const cfg = binding?.mode === "live" ? liveConfig(p.platform) : null;
  if (binding?.mode === "live" && !cfg)
    throw err(
      "PLATFORM_CONFIGURATION_REQUIRED: live binding requires a platform endpoint and token; simulation was not dispatched",
    );
  const adapter = cfg ? liveBuildPlatform(p.platform, cfg) : simulatedBuildPlatform();
  const model_version =
    adapter.mode === "simulated"
      ? "sim-1"
      : (process.env[`BUILD_PLATFORM_${p.platform.toUpperCase()}_MODEL`] ?? "unpinned");
  const actor = ctx.actor;
  // ceilings, clearance and the reproducibility key are checked by the database BEFORE anything leaves THREAD
  const d = await sb.rpc("thread_dispatch_build", {
    p_actor: actor,
    p: { ...p, model_version, adapter_mode: adapter.mode },
  } as never);
  if (d.error) throw err(d.error.message);
  const disp = d.data as unknown as {
    run_id: string;
    human_ref: string;
    repro_key: { model_version: string; template_version: string; guardrail_set_version: string };
  };
  let result: Json;
  try {
    const { external_run_id } = await adapter.dispatch({
      platform: p.platform,
      prompt_id: p.prompt_id,
      run_id: disp.run_id,
      compiled_prompt: cp.compiled_text,
      compiled_hash: cp.compiled_hash,
      repro_key: disp.repro_key,
      cost_ceiling: p.cost_ceiling,
    });
    if (adapter.mode === "live") {
      const accepted = await sb.rpc("thread_bind_external_build", {
        p_actor: actor,
        p_run: disp.run_id,
        p_external: external_run_id,
      } as never);
      if (accepted.error) throw err(accepted.error.message);
      return {
        run_id: disp.run_id,
        human_ref: disp.human_ref,
        status: "dispatched",
        note: "results arrive by signed webhook",
      } as Json;
    }
    const st = await adapter.status(external_run_id);
    const artifacts = st.state === "succeeded" ? await adapter.fetchArtifacts(external_run_id) : [];
    const r = await sb.rpc("thread_record_build_result", {
      p_actor: actor,
      p: {
        run_id: disp.run_id,
        external_run_id,
        status: st.state === "succeeded" ? "succeeded" : "failed",
        cost_actual: st.cost,
        duration_ms: st.duration_ms,
        secrets_scan: st.secrets_scan,
        failure_reason: st.failure_reason,
        artifacts,
      },
    } as never);
    if (r.error) throw err(r.error.message);
    result = r.data as Json;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // A live timeout may follow an accepted external run; never falsely mark it failed or invite a duplicate build.
    if (adapter.mode === "live")
      throw err(
        `DISPATCH_RECONCILIATION_REQUIRED: external acceptance is uncertain; reconcile run ${disp.run_id} before retrying`,
      );
    const failed = await sb.rpc("thread_record_build_result", {
      p_actor: actor,
      p: { run_id: disp.run_id, status: "failed", failure_reason: msg.slice(0, 500) },
    } as never);
    if (failed.error) throw err(`RESULT_RECORDING_FAILED: reconcile run ${disp.run_id}`);
    throw e;
  }
  return { ...result, run_id: disp.run_id, human_ref: disp.human_ref } as Json;
}
