import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CreateObjectInput, ReviseInput, TransitionInput, TombstoneInput } from "@/domain/types/envelope";

// Human actor derived from the verified session, never from client input.
function humanActor(userId: string) {
  return { kind: "human", id: userId, authority_used: "observe" };
}

// Maps database error codes to the Section 19 error model.
function toThreadError(message: string): Error {
  const code = message.split(":")[0]?.trim() || "ERROR";
  return new Error(JSON.stringify({ code, explanation: message }));
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listObjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q?: string | undefined; type?: string | undefined; includeTombstones?: boolean | undefined }) => d)
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("objects")
      .select("id,human_ref,type,title,statement,lifecycle_state,version,risk_tier,authority_level,data_classification,review_date,is_tombstone,updated_at,content_hash")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (data.type) query = query.eq("type", data.type);
    if (!data.includeTombstones) query = query.eq("is_tombstone", false);
    if (data.q) query = query.textSearch("search", data.q, { type: "websearch" });
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getRegistry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [reg, tr, init] = await Promise.all([
      context.supabase.from("object_type_registry").select("type,family,ref_prefix,lifecycle_family,discovery_descriptor").order("family"),
      context.supabase.from("lifecycle_transitions").select("lifecycle_family,from_state,to_state"),
      context.supabase.from("lifecycle_initial_states").select("lifecycle_family,state"),
    ]);
    if (reg.error) throw new Error(reg.error.message);
    return { types: reg.data ?? [], transitions: tr.data ?? [], initial: init.data ?? [] };
  });

export const getObjectDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [obj, versions, ledger] = await Promise.all([
      context.supabase.from("objects").select("id,human_ref,type,title,statement,machine_description,version,lifecycle_state,risk_tier,authority_level,data_classification,review_date,expiration_condition,retirement_path,created_by,permission,content_hash,provenance_chain_id,is_tombstone,retirement_reason").eq("id", data.id).maybeSingle(),
      context.supabase.from("object_versions").select("version,title,statement,lifecycle_state,content_hash,updated_at,updated_by,is_tombstone,risk_tier").eq("id", data.id).order("version", { ascending: false }),
      context.supabase.from("ledger").select("seq,occurred_at,actor,action,object_version,payload,prev_hash,hash,adapter_mode").eq("object_id", data.id).order("seq", { ascending: false }),
    ]);
    if (obj.error) throw new Error(obj.error.message);
    if (!obj.data) return null;
    return { object: obj.data, versions: versions.data ?? [], ledger: ledger.data ?? [] };
  });

export const createObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateObjectInput.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: row, error } = await db.rpc("thread_create_object", { p_actor: humanActor(context.userId), p: data as never });
    if (error) throw toThreadError(error.message);
    return row as { id: string; human_ref: string };
  });

export const reviseObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReviseInput.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { error } = await db.rpc("thread_revise_object", {
      p_actor: humanActor(context.userId), p_id: data.id, p_expected_version: data.expected_version, p_patch: data.patch as never, p_rationale: data.rationale,
    });
    if (error) throw toThreadError(error.message);
    return { ok: true };
  });

export const transitionObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TransitionInput.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { error } = await db.rpc("thread_transition_object", {
      p_actor: humanActor(context.userId), p_id: data.id, p_expected_version: data.expected_version, p_to_state: data.to_state, p_rationale: data.rationale,
    });
    if (error) throw toThreadError(error.message);
    return { ok: true };
  });

export const tombstoneObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TombstoneInput.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { error } = await db.rpc("thread_tombstone_object", {
      p_actor: humanActor(context.userId), p_id: data.id, p_expected_version: data.expected_version, p_reason: data.reason,
    });
    if (error) throw toThreadError(error.message);
    return { ok: true };
  });

export const verifyLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("thread_verify_ledger");
    if (error) throw new Error(error.message);
    return data as { ok: boolean; entries_checked: number; first_bad_seq: number | null; head_hash: string };
  });

export const getExitEvidence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("ledger").select("seq,occurred_at,actor,payload,hash")
      .eq("action", "phase1.exit_evidence").order("seq", { ascending: false }).limit(1).maybeSingle();
    return data;
  });

export const runExitEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { data, error } = await db.rpc("thread_record_phase1_evidence", { p_actor: humanActor(context.userId) });
    if (error) throw new Error(error.message);
    return data;
  });
