/**
 * Phase 9 MCP gateway surface (Part 11.12): agent registry, quotas, audit, K3 confirmations and exit evidence.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const human = (id: string) => ({ kind: "human", id, authority_used: "observe" });
const LEVELS = ["observe", "recommend", "act_with_confirmation", "act_bounded", "autonomous_with_exception"] as const;
function err(message: string): Error {
  const code = message.split(":")[0]?.trim() || "ERROR";
  return new Error(JSON.stringify({ code, explanation: message }));
}
async function admin() { return (await import("@/integrations/supabase/client.server")).supabaseAdmin; }

export const listAgentSurface = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { TOOLS } = await import("@/domain/mcp-tools");
    const [agents, calls, tokens, findings, steward] = await Promise.all([
      sb.from("agents").select("id,name,mandate,authority_ceiling,quota,cost_cap,state,token_prefix,created_at,revoked_at,owner_id,a2a_card").order("created_at", { ascending: false }),
      sb.from("agent_calls").select("id,agent_id,tool,method,authority_used,status,refusal_code,error,cost,duration_ms,started_at,ledger_seq,input_hash,output_hash,origin_tags").order("started_at", { ascending: false }).limit(100),
      sb.from("confirmation_tokens").select("id,agent_id,tool,reason,issued_at,expires_at,consumed_at").order("issued_at", { ascending: false }).limit(30),
      sb.from("detector_findings").select("id,severity,state,created_at,evidence").eq("detector_key", "InstructionInjectionAttempt").order("created_at", { ascending: false }).limit(20),
      sb.rpc("has_role", { _uid: context.userId, _role: "steward" } as never),
    ]);
    const c = calls.data ?? [];
    const health = { calls: c.length, ok: c.filter((x) => x.status === "ok").length, refused: c.filter((x) => x.status === "refused").length,
      blocked: c.filter((x) => x.status === "blocked").length, errors: c.filter((x) => x.status === "error").length,
      p95_ms: (() => { const d = c.filter((x) => x.duration_ms != null).map((x) => x.duration_ms as number).sort((a, b) => a - b); return d.length ? d[Math.min(d.length - 1, Math.ceil(d.length * 0.95) - 1)] : null; })() };
    return {
      agents: agents.data ?? [], calls: c, tokens: tokens.data ?? [], injection_findings: findings.data ?? [], is_steward: !!steward.data, health,
      tools: TOOLS.map((t) => ({ name: t.name, kernel: t.kernel, purpose: t.purpose, authority: t.authority, side_effects: t.side_effects, high_consequence: t.high_consequence, status: t.status, pending: t.pending ?? null })),
    };
  });

export const registerAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    name: z.string().trim().min(2).max(80), mandate: z.string().trim().min(5).max(1000), authority_ceiling: z.enum(LEVELS),
    calls_per_minute: z.number().int().min(1).max(600).default(60), calls_per_day: z.number().int().min(1).max(100000).default(2000),
    cost_cap: z.number().min(0).max(100000).default(10), canon_types: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { cardConflict, registrationRefusal, sha256Hex } = await import("@/domain/mcp");
    const { data: isSteward } = await context.supabase.rpc("has_role", { _uid: context.userId, _role: "steward" } as never);
    const refusal = registrationRefusal(data.authority_ceiling, !!isSteward); if (refusal) throw err(refusal);
    const { data: types } = await context.supabase.from("object_type_registry").select("type");
    const card = { name: data.name, description: data.mandate, canon_types: data.canon_types, mcp: "/api/public/mcp" };
    const conflict = cardConflict(card, (types ?? []).map((t) => t.type)); if (conflict) throw err(conflict);
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = `thr_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
    const agentKey = crypto.randomUUID();
    const { createAgentIdentity } = await import("@/server/mcp/agent-session.server");
    const authUserId = await createAgentIdentity(agentKey, data.name);
    const db = await admin();
    const { data: r, error } = await db.rpc("thread_register_agent", { p_actor: human(context.userId), p: {
      name: data.name, mandate: data.mandate, authority_ceiling: data.authority_ceiling, quota: { calls_per_minute: data.calls_per_minute, calls_per_day: data.calls_per_day },
      cost_cap: data.cost_cap, a2a_card: card, token_hash: await sha256Hex(token), token_prefix: token.slice(0, 10), auth_user_id: authUserId,
    } } as never);
    if (error) { await db.auth.admin.deleteUser(authUserId); throw err(error.message); }
    // The identity is keyed by agentKey; record the mapping so sessions can be minted for this agent id.
    const out = r as unknown as { agent_id: string; ledger_seq: number };
    await db.auth.admin.updateUserById(authUserId, { email: (await import("@/server/mcp/agent-session.server")).agentEmail(out.agent_id), email_confirm: true, app_metadata: { thread_agent: true, agent_id: out.agent_id } });
    return { ...out, token };
  });

export const revokeAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ agent_id: z.string().uuid(), reason: z.string().trim().min(3).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: seq, error } = await (await admin()).rpc("thread_revoke_agent", { p_actor: human(context.userId), p_agent: data.agent_id, p_reason: data.reason } as never);
    if (error) throw err(error.message);
    return { ledger_seq: seq as unknown as number };
  });

/** K3: a person confirms exactly one call. The hash is computed from the tool's own schema, as the gateway does. */
export const issueConfirmation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ agent_id: z.string().uuid(), tool: z.string().min(1).max(80), arguments_json: z.string().max(20000), reason: z.string().trim().min(3).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { TOOL_BY_NAME } = await import("@/domain/mcp-tools");
    const { canonicalJson, sha256Hex } = await import("@/domain/mcp");
    const t = TOOL_BY_NAME.get(data.tool); if (!t) throw err("UNKNOWN_TOOL");
    if (!t.high_consequence) throw err("CONFIRMATION_NOT_NEEDED: this tool does not take a confirmation token");
    let raw: unknown; try { raw = JSON.parse(data.arguments_json); } catch { throw err("VALIDATION_FAILED: arguments must be JSON"); }
    const parsed = t.input.safeParse(raw);
    if (!parsed.success) throw err(`VALIDATION_FAILED: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    const { confirmation_token: _c, ...bound } = parsed.data as Record<string, unknown>;
    const hash = await sha256Hex(canonicalJson(bound));
    const { data: r, error } = await (await admin()).rpc("thread_issue_confirmation", { p_actor: human(context.userId), p_agent: data.agent_id, p_tool: data.tool, p_input_hash: hash, p_reason: data.reason } as never);
    if (error) throw err(error.message);
    return { ...(r as unknown as { token_id: string; expires_at: string; ledger_seq: number }), input_hash: hash };
  });

export const getPhase9Evidence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("ledger").select("seq,occurred_at,payload").eq("action", "phase9.exit_evidence").order("seq", { ascending: false }).limit(1).maybeSingle();
    return data;
  });

/** Exit evidence is computed from the database, never trusted from the browser. */
export const runPhase9Evidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ agent_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { measureInjectionRecall } = await import("@/domain/mcp");
    const { TOOLS, VALUEOS_TOOLS } = await import("@/domain/mcp-tools");
    const db = await admin();
    const { data: r, error } = await db.rpc("thread_record_phase9_evidence", { p_actor: human(context.userId), p: {
      agent_id: data.agent_id, injection_corpus: measureInjectionRecall(), tool_count: TOOLS.length,
      valueos_present: VALUEOS_TOOLS.every((n) => TOOLS.some((t) => t.name === n)),
      status_counts: TOOLS.reduce<Record<string, number>>((m, t) => ((m[t.status] = (m[t.status] ?? 0) + 1), m), {}),
    } } as never);
    if (error) throw err(error.message);
    return r as unknown as { ledger_seq: number; passed: boolean; checks: Array<{ name: string; pass: boolean; detail: string }> };
  });
