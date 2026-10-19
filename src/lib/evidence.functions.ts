/**
 * Phase 5 Evidence graph server functions (Part 5). Every read runs as the caller so object permissions apply.
 * The same SQL functions back the future MCP tools (tool_contracts rows), so the view and the tools never differ.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TRACES } from "@/domain/evidence";

function err(message: string): Error {
  const code = message.split(":")[0]?.trim() || "ERROR";
  return new Error(JSON.stringify({ code, explanation: message }));
}
const uuid = z.string().uuid();
const ROOT_TYPES = [
  "ComposableCapability",
  "WorkingCapability",
  "BehaviorStatement",
  "ConfirmedDecision",
  "ExposureAuthorization",
  "ProductionOutcome",
  "Incident",
  "Guardrail",
  "Pattern",
  "Authority",
  "Rule",
  "AuthorityGrant",
];

export const listEvidenceRoots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("objects")
      .select("id,human_ref,type,title,lifecycle_state")
      .in("type", ROOT_TYPES)
      .eq("is_tombstone", false)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw err(error.message);
    return data ?? [];
  });

export interface Cited {
  id: string;
  ref: string;
  type: string;
  title: string;
}
export interface Answer {
  question: string;
  answered: boolean;
  answer: string;
  citations: Cited[];
}
export interface ChainObj {
  id: string;
  ref: string;
  type: string;
  title: string;
  state: string;
  version: number;
  created_at: string;
  evidence_refs: string[];
}
export interface ChainLinkRow {
  hop: number;
  link: string;
  label: string;
  objects: ChainObj[];
}

export const explainAll = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const t0 = Date.now();
    const [ex, ch] = await Promise.all([
      context.supabase.rpc("explain_capability_all", { p_id: data.id }),
      context.supabase.rpc("trace_full_chain", { p_id: data.id }),
    ]);
    if (ex.error) throw err(ex.error.message);
    if (ch.error) throw err(ch.error.message);
    const e = ex.data as unknown as {
      root: ChainObj;
      completeness: { present: number; total: number; missing: string[]; score: number };
      answers: Answer[];
    };
    const c = ch.data as unknown as {
      links: ChainLinkRow[];
      capabilities: ChainObj[];
      incidents: ChainObj[];
    };
    return { ...e, links: c.links, capabilities: c.capabilities, ms: Date.now() - t0 };
  });

const traceFns = TRACES.map((t) => t.fn) as unknown as [string, ...string[]];

export const runTrace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fn: string; id?: string | undefined }) =>
    z.object({ fn: z.enum(traceFns), id: uuid.optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const t = TRACES.find((x) => x.fn === data.fn);
    if (!t) throw err("UNKNOWN_TRACE: no registered query");
    const args: Record<string, unknown> = {};
    if (t.input) {
      if (!data.id) throw err("INPUT_REQUIRED: choose a starting object for this query");
      const keys: Record<string, string> = {
        trace_blast_radius: "p_behavior",
        trace_canon_change_impact: "p_id",
        trace_incident_to_decision: "p_incident",
        trace_retirement_impact: "p_capability",
        trace_full_chain: "p_id",
      };
      const key = keys[data.fn];
      if (!key) throw err("UNKNOWN_TRACE: missing input mapping");
      args[key] = data.id;
    }
    const t0 = Date.now();
    const { data: r, error } = await context.supabase.rpc(data.fn as never, args as never);
    const ms = Date.now() - t0;
    if (error) throw err(error.message);
    return { result: JSON.stringify(r), ms, budget: t.budget, within: ms < t.budget };
  });

export const getPhase5Evidence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("ledger")
      .select("seq,occurred_at,payload")
      .eq("action", "phase5.exit_evidence")
      .order("seq", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  });

export const runPhase5Evidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data, error } = await db.rpc("thread_record_phase5_evidence", {
      p_actor: { kind: "human", id: context.userId, authority_used: "observe" },
      p: {} as never,
    });
    if (error) throw err(error.message);
    return data as unknown as {
      ledger_seq: number;
      selftest: { passed: boolean; checks: { name: string; pass: boolean; detail: string }[] };
    };
  });
