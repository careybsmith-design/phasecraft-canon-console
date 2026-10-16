/**
 * Phase 7 server functions: shadow runs, exposure authorisation, kill switch, production outcomes,
 * incidents, rollbacks and value measures (Part 9). All writes go through the thread_* SQL functions.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
function err(message: string): Error {
  const code = message.split(":")[0]?.trim() || "ERROR";
  return new Error(JSON.stringify({ code, explanation: message }));
}
const human = (id: string) => ({ kind: "human", id, authority_used: "observe" });

export const listShadowOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [caps, runs, discs, eas, outcomes, incidents, measures] = await Promise.all([
      sb.from("objects").select("id,human_ref,type,title,authority_level,lifecycle_state")
        .in("type", ["ComposableCapability", "WorkingCapability"]).eq("is_tombstone", false).order("updated_at", { ascending: false }).limit(100),
      sb.from("objects").select("id,human_ref,title,body,created_at").eq("type", "ShadowRun").eq("is_tombstone", false).order("created_at", { ascending: false }).limit(30),
      sb.from("objects").select("id,human_ref,title,body,created_at").eq("type", "Discrepancy").eq("is_tombstone", false).order("created_at", { ascending: false }).limit(50),
      sb.from("objects").select("id,human_ref,title,body,lifecycle_state,created_at").eq("type", "ExposureAuthorization").eq("is_tombstone", false).order("created_at", { ascending: false }).limit(30),
      sb.from("objects").select("id,human_ref,title,body,created_at").eq("type", "ProductionOutcome").eq("is_tombstone", false).order("created_at", { ascending: false }).limit(20),
      sb.from("objects").select("id,human_ref,title,body,created_at").eq("type", "Incident").eq("is_tombstone", false).order("created_at", { ascending: false }).limit(20),
      sb.from("objects").select("id,human_ref,title,body,created_at").eq("type", "ValueMeasure").eq("is_tombstone", false).order("created_at", { ascending: false }).limit(20),
    ]);
    for (const q of [caps, runs, discs, eas, outcomes, incidents, measures]) if (q.error) throw err(q.error.message);
    return {
      capabilities: caps.data ?? [], shadowRuns: runs.data ?? [], discrepancies: discs.data ?? [],
      exposures: eas.data ?? [], outcomes: outcomes.data ?? [], incidents: incidents.data ?? [], valueMeasures: measures.data ?? [],
    };
  });

const DiscrepancyInput = z.object({
  case_ref: z.string().trim().min(1).max(80),
  shadow_decision: z.string().trim().min(1).max(500),
  actual_decision: z.string().trim().min(1).max(500),
  delta: z.string().max(500).optional(),
  hypothesised_cause: z.enum(["data_distribution", "edge_case", "policy_gap", "model_error", "integration", "unknown"]),
});

export const recordShadowRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    capability_id: uuid, sample_size: z.number().int().positive().max(1_000_000),
    period: z.string().trim().max(80).default(""), event_source: z.string().trim().max(200).default("telemetry tap"),
    discrepancies: z.array(DiscrepancyInput).max(10_000).default([]),
    adapter_mode: z.enum(["simulated", "live"]).default("simulated"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data: r, error } = await db.rpc("thread_record_shadow_run", {
      p_actor: human(context.userId), p_capability: data.capability_id,
      p: { sample_size: data.sample_size, period: data.period, event_source: data.event_source, discrepancies: data.discrepancies, adapter_mode: data.adapter_mode } as never,
    });
    if (error) throw err(error.message);
    return r;
  });

export const authorizeExposure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    capability_id: uuid, population_pct: z.number().positive().max(100),
    evidence_bundle_ref: uuid, kill_switch_ref: z.string().trim().min(1).max(120),
    authority_level_granted: z.enum(["observe", "recommend", "act_with_confirmation", "act_bounded", "autonomous_with_exception"]).optional(),
    cohort: z.string().trim().max(200).default(""), effective_to: z.string().optional(),
    continuous_monitoring: z.boolean().default(false), independent_human_judgment_ref: z.string().default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data: r, error } = await db.rpc("thread_authorize_exposure", {
      p_actor: human(context.userId), p_capability: data.capability_id,
      p: { population_pct: data.population_pct, evidence_bundle_ref: data.evidence_bundle_ref, kill_switch_ref: data.kill_switch_ref,
        authority_level_granted: data.authority_level_granted, cohort: data.cohort, effective_to: data.effective_to,
        rollback_armed: "true", continuous_monitoring: String(data.continuous_monitoring),
        independent_human_judgment_ref: data.independent_human_judgment_ref } as never,
    });
    if (error) throw err(error.message);
    return r;
  });

export const pullKillSwitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ capability_id: uuid, reason: z.string().trim().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data: r, error } = await db.rpc("thread_kill_switch", { p_actor: human(context.userId), p_capability: data.capability_id, p: { reason: data.reason } as never });
    if (error) throw err(error.message);
    return r;
  });

export const recordProductionOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    capability_id: uuid, period: z.string().trim().min(1).max(80), events_processed: z.number().int().min(0).default(0),
    behaviour_observed: z.string().trim().max(2000).default(""), cost: z.number().min(0).default(0),
    adapter_mode: z.enum(["simulated", "live"]).default("simulated"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data: r, error } = await db.rpc("thread_record_production_outcome", {
      p_actor: human(context.userId), p_capability: data.capability_id,
      p: { period: data.period, events_processed: data.events_processed, behaviour_observed: data.behaviour_observed, cost: data.cost, adapter_mode: data.adapter_mode } as never,
    });
    if (error) throw err(error.message);
    return r;
  });

export const recordIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    capability_id: uuid, severity: z.enum(["minor", "major", "critical"]),
    description: z.string().trim().min(1).max(2000), detection: z.string().trim().max(500).default(""),
    response: z.string().trim().max(500).default(""), root_cause: z.string().trim().max(500).default(""),
    adapter_mode: z.enum(["simulated", "live"]).default("simulated"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data: r, error } = await db.rpc("thread_record_incident", {
      p_actor: human(context.userId), p_capability: data.capability_id,
      p: { severity: data.severity, description: data.description, detection: data.detection, response: data.response, root_cause: data.root_cause, adapter_mode: data.adapter_mode } as never,
    });
    if (error) throw err(error.message);
    return r;
  });

export const recordValueMeasure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    mission_id: uuid, title: z.string().trim().min(1).max(150), statement: z.string().trim().max(1000).default("value measured"),
    value: z.number(), unit: z.string().trim().max(40).default(""), baseline: z.number(), delta: z.number(),
    confidence: z.number().min(0).max(1).default(0), source_evidence: z.array(uuid).default([]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data: r, error } = await db.rpc("thread_record_value_measure", {
      p_actor: human(context.userId), p_mission: data.mission_id,
      p: { title: data.title, statement: data.statement, value: data.value, unit: data.unit, baseline: data.baseline,
        delta: data.delta, confidence: data.confidence, source_evidence: data.source_evidence } as never,
    });
    if (error) throw err(error.message);
    return r;
  });

export const getPhase7Evidence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("ledger").select("seq,occurred_at,payload")
      .eq("action", "phase7.exit_evidence").order("seq", { ascending: false }).limit(1).maybeSingle();
    return data;
  });

export const runPhase7Evidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data, error } = await db.rpc("thread_record_phase7_evidence", { p_actor: human(context.userId), p: {} as never });
    if (error) throw err(error.message);
    return data as unknown as { ledger_seq: number; selftest: { passed: boolean; checks: { name: string; pass: boolean; detail: string }[] } };
  });
