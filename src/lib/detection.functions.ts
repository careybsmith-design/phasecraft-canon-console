import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
const actor = (id: string) => ({ kind: "human", id, authority_used: "observe" });
export const listDetection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [rules, findings, objects, role, evidence] = await Promise.all([
      context.supabase.from("detectors").select("*").order("family").order("key"),
      context.supabase
        .from("detector_findings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300),
      context.supabase
        .from("objects")
        .select("id,human_ref,title,type")
        .eq("is_tombstone", false)
        .order("updated_at", { ascending: false })
        .limit(300),
      context.supabase.rpc("has_role", { _uid: context.userId, _role: "steward" }),
      context.supabase
        .from("ledger")
        .select("seq,payload,occurred_at")
        .eq("action", "phase10.exit_evidence")
        .order("seq", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    for (const r of [rules, findings, objects, role, evidence])
      if (r.error) throw new Error(r.error.message);
    return {
      rules: rules.data ?? [],
      findings: findings.data ?? [],
      objects: objects.data ?? [],
      is_steward: Boolean(role.data),
      user_id: context.userId,
      evidence: evidence.data,
    };
  });
export const sweepDetection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _uid: context.userId,
      _role: "steward",
    });
    if (error || !data) throw new Error("Only a steward may run a full sweep.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await supabaseAdmin.rpc("thread_detection_sweep", { p_actor: actor(context.userId) });
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
export const observeDetection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        subject_id: z.string().uuid().nullable(),
        fact: z.string().max(100),
        rationale: z.string().trim().min(3).max(2000),
        evidence_refs: z.array(z.string().uuid()).max(20),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: member } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .limit(1);
    if (!member?.length) throw new Error("Membership required.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await supabaseAdmin.rpc("thread_observe_detection", {
      p_actor: actor(context.userId),
      p_subject: data.subject_id,
      p_facts: { [data.fact]: true },
      p_evidence: data.evidence_refs,
      p_rationale: data.rationale,
    } as never);
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
export const resolveDetection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        finding_id: z.string().uuid(),
        resolution: z.string().trim().min(3).max(1000),
        accept_until: z.string().datetime().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: f } = await context.supabase
      .from("detector_findings")
      .select("id,owner_id")
      .eq("id", data.finding_id)
      .maybeSingle();
    if (!f) throw new Error("Finding not visible.");
    const { data: steward } = await context.supabase.rpc("has_role", {
      _uid: context.userId,
      _role: "steward",
    });
    if (f.owner_id !== context.userId && !steward)
      throw new Error("Finding owner or steward required.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await supabaseAdmin.rpc("thread_resolve_finding", {
      p_actor: actor(context.userId),
      p_finding: data.finding_id,
      p_resolution: data.resolution,
      ...(data.accept_until ? { p_accept_until: data.accept_until } : {}),
    });
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
export const recordDetectionEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: steward } = await context.supabase.rpc("has_role", {
      _uid: context.userId,
      _role: "steward",
    });
    if (!steward) throw new Error("Steward required.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await supabaseAdmin.rpc("thread_record_phase10_evidence", {
      p_actor: actor(context.userId),
    });
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
export const readMeasurements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await context.supabase.rpc("phase10_measurements_extended");
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
