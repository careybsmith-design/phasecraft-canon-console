import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AssuranceInput } from "@/domain/hardening";
import { verificationIndependence, type VerificationRecord } from "@/domain/verification-independence";

export const assuranceQuery = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [checks, sources, role, tests] = await Promise.all([
    context.supabase.rpc("phase12_assurance_checks"),
    context.supabase.from("objects").select("id,human_ref,type,title,data_classification,version").eq("is_tombstone", false).order("updated_at", { ascending: false }).limit(200),
    context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
    context.supabase.from("objects").select("id,body,simulated").eq("type", "TestRun").eq("is_tombstone", false).limit(1000),
  ]);
  if (checks.error || sources.error || role.error || tests.error) throw new Error("Assurance evidence could not be read.");
  const records: VerificationRecord[] = (tests.data ?? []).map(t => {
    const body = t.body as Record<string, unknown>;
    const text = (key: string) => typeof body[key] === "string" ? String(body[key]) : "";
    return { id:t.id, compliance_scoped:body['compliance_scoped'] !== false, code_route:text('code_route'), test_route:text('test_route'), implementation_visible:body['implementation_visible'] !== false, human_reviewed:body['human_reviewed'] === true && !t.simulated, provenance:text('provenance'), confirmed_behavior_ref:text('confirmed_behavior_ref') || null, outcome_contract_ref:text('outcome_contract_ref') || null, mutation_sample_passed:body['mutation_sample_passed'] === true, cycle_reviewed:body['cycle_reviewed'] === true };
  });
  return { independence: verificationIndependence(records), checks: checks.data as unknown as Array<{ id: string; human_ref: string; title: string; body: { assurance_kind: string; result: string; evidence: string[]; rationale: string }; review_date: string }>, sources: sources.data ?? [], can_record: role.data?.some((r) => r.role === "steward" || r.role === "compliance") ?? false };
});

export type AcceptanceBlockers = {
  orphans: { count: number; nodes: Array<{ id: string; human_ref: string; type: string; title: string; lifecycle_state: string }> };
  action_ratio: { action_pct: number | null; read_only_pct: number | null; status: string; thresholds: string | null; evidence: { sessions: number } };
  aw5_setting: { key: string; value: string | null; status: string } | null;
};

/** Acceptance blockers: orphan reconciliation list, AW-5 decision state, and the tracked exit checklist. */
export const acceptanceBlockers = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<AcceptanceBlockers> => {
  const [orphans, ratio, setting] = await Promise.all([
    context.supabase.rpc("graph_orphans", { p_limit: 500 }),
    context.supabase.rpc("phase10_action_ratios"),
    context.supabase.from("canon_settings").select("key,value,status").eq("key", "anti_wiki.action_ratio").maybeSingle(),
  ]);
  if (orphans.error || ratio.error || setting.error) throw new Error("Acceptance blockers could not be read.");
  const nodes = (orphans.data as { nodes?: AcceptanceBlockers["orphans"]["nodes"] })?.nodes ?? [];
  const rawRatio = ratio.data as { action_pct: number | null; read_only_pct: number | null; status: string; thresholds?: unknown; evidence?: { sessions: number } };
  const rawSetting = setting.data as { key: string; value: unknown; status: string } | null;
  return {
    orphans: { count: (orphans.data as { count?: number })?.count ?? 0, nodes },
    action_ratio: { action_pct: rawRatio.action_pct, read_only_pct: rawRatio.read_only_pct, status: rawRatio.status, thresholds: rawRatio.thresholds == null ? null : JSON.stringify(rawRatio.thresholds), evidence: { sessions: rawRatio.evidence?.sessions ?? 0 } },
    aw5_setting: rawSetting ? { key: rawSetting.key, status: rawSetting.status, value: rawSetting.value == null ? null : JSON.stringify(rawSetting.value) } : null,
  };
});

export const recordAssurance = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AssuranceInput.parse(input)).handler(async ({ data, context }) => {
    const { data: roles, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (error || !roles?.some((r) => r.role === "steward" || r.role === "compliance")) throw new Error("Assurance requires a steward or compliance authority.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordAssuranceCore } = await import("@/server/ops/assurance.server");
    return recordAssuranceCore({ sb: context.supabase, db: supabaseAdmin, userId: context.userId, actor: { kind: "human", id: context.userId, authority_used: "observe" } }, data);
  });

export const runHardeningChecks = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: roles, error: roleError } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  if (roleError || !roles?.some((r) => r.role === "steward" || r.role === "compliance")) throw new Error("Assurance requires a steward or compliance authority.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("thread_hardening_checks", { p_actor: { kind: "human", id: context.userId, authority_used: "observe" } });
  if (error) throw new Error("Internal checks could not be recorded.");
  return data as unknown as { passed_internal_checks: boolean; exposed_privileged_writes: number; tables_without_rls: number; live_objects_without_expiration: number; ledger_seq: number; ledger: { ok: boolean; entries_checked: number }; snapshot_replay: { ok: boolean; mode: string; objects: number } };
});

export const assessorPack = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ subject_id: z.string().uuid() }).parse(input)).handler(async ({ data, context }) => {
    const start = Date.now();
    const { data: subject, error } = await context.supabase.from("objects").select("id,human_ref,type,title,version,content_hash").eq("id", data.subject_id).maybeSingle();
    if (error || !subject) throw new Error("This subject is outside your permissions.");
    const [answers, chain, checks] = await Promise.all([
      context.supabase.rpc("explain_capability_all", { p_id: subject.id }), context.supabase.rpc("trace_full_chain", { p_id: subject.id }),
      context.supabase.from("objects").select("id,human_ref,body,evidence_refs,content_hash,version").eq("type", "ControlCheck").eq("body->>subject_ref", subject.id).eq("is_tombstone", false).limit(100),
    ]);
    if (answers.error || chain.error || checks.error) throw new Error("The assessor query could not be completed.");
    return { subject, answers: answers.data, chain: chain.data, checks: checks.data, elapsed_ms: Date.now() - start, generated_at: new Date().toISOString(), marker: "Query evidence, not canon or a certification", limitation: "THREAD records decisions, evidence, authority and observed outcomes. It cannot prove evidence is true, controls are effective, or decisions are wise." };
  });