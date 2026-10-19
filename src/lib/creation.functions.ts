/**
 * Phase 6 creation loop server functions (Part 8). Reads run as the caller; writes go through thread_* functions
 * with the actor taken from the verified session. Dispatch always goes through the BuildPlatform adapter.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  compileCreationPrompt,
  platformRefusal,
  PLATFORMS,
  type Platform,
  type Classification,
} from "@/domain/creation";

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
const strs = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export const listCreation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const sel = "id,human_ref,title,statement,lifecycle_state,data_classification,body,created_at";
    const [bs, eo, tp, rc, cp, prompts, runs, br, its, plats, finds, ms] = await Promise.all([
      sb
        .from("objects")
        .select(sel)
        .eq("type", "BehaviorStatement")
        .eq("is_tombstone", false)
        .in("lifecycle_state", [
          "confirmed",
          "generating",
          "verified_in_simulation",
          "verified_in_shadow",
          "verified_in_production",
        ])
        .limit(200),
      sb
        .from("objects")
        .select(sel)
        .eq("type", "ExecutableOutcomeContract")
        .eq("is_tombstone", false)
        .eq("lifecycle_state", "active")
        .limit(100),
      sb
        .from("objects")
        .select(sel)
        .eq("type", "PromptTemplate")
        .eq("is_tombstone", false)
        .limit(100),
      sb
        .from("reuse_checks")
        .select("id,intent_shape,decision,behavior_statement_id,checked_at")
        .not("behavior_statement_id", "is", null)
        .order("checked_at", { ascending: false })
        .limit(100),
      sb
        .from("creation_prompts")
        .select(
          "object_id,reuse_check_id,source_behavior_ids,template_version,compiled_text,compiled_hash",
        )
        .limit(200),
      sb
        .from("objects")
        .select("id,human_ref,title,lifecycle_state,data_classification,body,created_at")
        .eq("type", "CreationPrompt")
        .eq("is_tombstone", false)
        .order("created_at", { ascending: false })
        .limit(100),
      sb
        .from("objects")
        .select("id,human_ref,title,lifecycle_state,created_at")
        .eq("type", "BuildRun")
        .order("created_at", { ascending: false })
        .limit(200),
      sb.from("build_runs").select("*").limit(500),
      sb.from("iterations").select("*").order("at", { ascending: false }).limit(50),
      sb.from("build_platforms").select("*"),
      sb
        .from("detector_findings")
        .select("id,object_id,severity,state,evidence,created_at")
        .eq("detector_key", "ScopeChangeSmuggledThroughIteration")
        .order("created_at", { ascending: false })
        .limit(50),
      sb
        .from("objects")
        .select("id,human_ref,title")
        .eq("type", "ValueMission")
        .eq("is_tombstone", false)
        .limit(100),
    ]);
    if (bs.error) throw err(bs.error.message);
    const cpBy = new Map((cp.data ?? []).map((c) => [c.object_id, c]));
    const brBy = new Map((br.data ?? []).map((r) => [r.object_id, r]));
    return {
      behaviors: bs.data ?? [],
      contracts: eo.data ?? [],
      templates: tp.data ?? [],
      reuse_checks: rc.data ?? [],
      missions: ms.data ?? [],
      prompts: (prompts.data ?? []).map((p) => ({ ...p, compiled: cpBy.get(p.id) ?? null })),
      runs: (runs.data ?? [])
        .filter((r) => brBy.has(r.id))
        .map((r) => ({ ...r, run: brBy.get(r.id)! })),
      iterations: its.data ?? [],
      platforms: plats.data ?? [],
      findings: finds.data ?? [],
    };
  });

export const compilePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        behavior_ids: z.array(z.string().uuid()).min(1).max(20),
        contract_id: z.string().uuid(),
        template_id: z.string().uuid(),
        reuse_check_id: z.string().uuid(),
        target_platform: z.enum(PLATFORMS),
        mission_ref: z.string().uuid().optional(),
        estimated_cost: z.number().min(0).max(100000).default(0),
        quoted_reference: z.string().max(280).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { compilePromptCore } = await import("@/server/ops/creation.server");
    return compilePromptCore(
      {
        sb: context.supabase,
        db: await admin(),
        actor: human(context.userId) as never,
        userId: context.userId,
      },
      data,
    );
  });

async function runOnPlatform(
  userId: string,
  p: {
    prompt_id: string;
    platform: Platform;
    cost_ceiling: number;
    estimated_cost: number;
    replay_of?: string;
  },
  sbUser?: unknown,
) {
  const { dispatchCore } = await import("@/server/ops/creation.server");
  const db = await admin();
  return dispatchCore(
    { sb: (sbUser ?? db) as never, db, actor: human(userId) as never, userId },
    p,
  );
}

export const dispatchBuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        prompt_id: z.string().uuid(),
        platforms: z.array(z.enum(PLATFORMS)).min(1).max(5),
        cost_ceiling: z.number().positive().max(100000),
        estimated_cost: z.number().min(0).max(100000).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const out: Array<{
      platform: Platform;
      ok: boolean;
      result: { human_ref: string; outcome: string | null } | null;
      error: string | null;
    }> = [];
    for (const platform of data.platforms) {
      try {
        {
          const x = (await runOnPlatform(context.userId, {
            prompt_id: data.prompt_id,
            platform,
            cost_ceiling: data.cost_ceiling,
            estimated_cost: data.estimated_cost,
          })) as Json;
          out.push({
            platform,
            ok: true,
            error: null,
            result: {
              human_ref: String(x["human_ref"]),
              outcome: x["outcome"] == null ? null : String(x["outcome"]),
            },
          });
        }
      } catch (e) {
        out.push({
          platform,
          ok: false,
          result: null,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return out;
  });

export const replayBuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ run_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r } = await context.supabase
      .from("build_runs")
      .select("prompt_id,platform,cost_ceiling")
      .eq("object_id", data.run_id)
      .single();
    if (!r) throw err("RUN_NOT_FOUND");
    const x = (await runOnPlatform(context.userId, {
      prompt_id: r.prompt_id,
      platform: r.platform as Platform,
      cost_ceiling: Number(r.cost_ceiling),
      estimated_cost: 0,
      replay_of: data.run_id,
    })) as Json;
    const rr = x["replay_result"] as { verdict?: string } | null | undefined;
    return { human_ref: String(x["human_ref"]), verdict: rr?.verdict ?? "dispatched" };
  });

export const recordIteration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        from_run: z.string().uuid(),
        to_run: z.string().uuid(),
        declared_class: z.enum(["cosmetic", "behavioural", "scope", "architecture"]),
        trigger: z.string().trim().max(300).optional(),
        diff: z.object({
          added_obligations: z.array(z.string().trim().min(1).max(300)).max(20),
          changed_results: z.array(z.string().trim().min(1).max(300)).max(20),
          changed_contracts: z.array(z.string().trim().min(1).max(300)).max(20),
          text_edits: z.array(z.string().trim().min(1).max(300)).max(20),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await (
      await admin()
    ).rpc("thread_record_iteration", { p_actor: human(context.userId), p: data } as never);
    if (error) throw err(error.message);
    return r as unknown as {
      human_ref: string;
      classification: string;
      detected_class: string;
      scope_change_flag: boolean;
      governance: string;
    };
  });

export const recordSkeleton = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        run_id: z.string().uuid(),
        mission_ref: z.string().uuid().optional(),
        one_real_user_process: z.string().trim().min(1).max(300),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await (
      await admin()
    ).rpc("thread_record_skeleton", { p_actor: human(context.userId), p: data } as never);
    if (error) throw err(error.message);
    return r as unknown as { human_ref: string };
  });

export const setCostCeiling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        scope: z.enum(["mission", "cell"]),
        scope_id: z.string().uuid(),
        ceiling: z.number().positive().max(10000000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (
      await admin()
    ).rpc("thread_set_cost_ceiling", { p_actor: human(context.userId), p: data } as never);
    if (error) throw err(error.message);
    return { ok: true };
  });

export const recordPhase6Evidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (
      await admin()
    ).rpc("thread_record_phase6_evidence", {
      p_actor: human(context.userId),
      p: { surface: "creation" },
    } as never);
    if (error) throw err(error.message);
    return data as unknown as {
      ledger_seq: number;
      live_builds: string;
      selftest: { passed: boolean; checks: { name: string; pass: boolean; detail: string }[] };
    };
  });
