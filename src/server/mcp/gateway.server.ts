/**
 * MCP gateway (Part 12, Section 11): JSON-RPC over Streamable HTTP (POST only, JSON responses).
 * Every tools/call: authenticate token -> validate against the tool's schema (layer 3) -> scan values (layer 4) ->
 * ceiling, quota, cost cap and K3 confirmation in the database -> run as the agent's identity -> provenance record.
 */
import { TOOLS, TOOL_BY_NAME, TOOL_CONTRACT_VERSION, toolContract, type ToolDef } from "@/domain/mcp-tools";
import { scanForInjection, sha256Hex, canonicalJson, withinCeiling, type AuthorityLevel } from "@/domain/mcp";
import type { Json } from "@/server/ops/context";
import { HANDLERS, type AgentCtx } from "./tools.server";
import { agentReadClient } from "./agent-session.server";

export const PROTOCOL_VERSION = "2025-06-18";
type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Json };
const ok = (id: Rpc["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const fail = (id: Rpc["id"], code: number, message: string, data?: unknown) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data ? { data } : {}) } });

async function admin() { return (await import("@/integrations/supabase/client.server")).supabaseAdmin; }

let synced = false;
export async function syncContracts() {
  if (synced) return;
  const db = await admin();
  await db.rpc("thread_sync_tool_contracts", { p: TOOLS.map(toolContract) as never, p_version: TOOL_CONTRACT_VERSION });
  synced = true;
}

type Agent = { id: string; name: string; auth_user_id: string | null; owner_id: string; authority_ceiling: AuthorityLevel };
async function lookupAgent(tokenHash: string): Promise<Agent | null> {
  const db = await admin();
  const { data } = await db.from("agents").select("id,name,auth_user_id,owner_id,authority_ceiling,state").eq("token_hash", tokenHash).maybeSingle();
  return data && data.state === "active" ? (data as unknown as Agent) : null;
}

/** Non-tool methods still go through begin/end so reads of resources and prompts carry provenance and quota. */
async function metered<T>(tokenHash: string, label: string, args: unknown, fn: (agent: Agent) => Promise<T>) {
  const db = await admin();
  const input_hash = await sha256Hex(canonicalJson(args ?? {}));
  const { data: b } = await db.rpc("thread_agent_begin_call", { p_token_hash: tokenHash, p_tool: label, p_input_hash: input_hash, p_authority_required: "observe",
    p_cost: 0.01, p_high_consequence: false, p_confirmation: null as never, p_method: label.split(":")[0] } as never);
  const bb = b as unknown as { refused: boolean; code?: string; explanation?: string; call_id?: string; agent?: Agent };
  if (bb.refused) throw Object.assign(new Error(`${bb.code}: ${bb.explanation}`), { rpc: -32001 });
  try {
    const out = await fn(bb.agent!);
    await db.rpc("thread_agent_end_call", { p_call: bb.call_id!, p_status: "ok", p_output_hash: await sha256Hex(canonicalJson(out)), p_error: null as never, p_origin_tags: ["canon"] as never });
    return out;
  } catch (e) {
    await db.rpc("thread_agent_end_call", { p_call: bb.call_id!, p_status: "error", p_output_hash: null as never, p_error: (e as Error).message.slice(0, 500), p_origin_tags: [] as never });
    throw e;
  }
}

function explain(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  try { const j = JSON.parse(m) as { code: string; explanation: string }; return j; } catch { return { code: m.split(":")[0]?.trim() || "ERROR", explanation: m }; }
}

export async function callTool(tokenHash: string, name: string, rawArgs: unknown) {
  const t = TOOL_BY_NAME.get(name);
  if (!t) return { isError: true, code: "UNKNOWN_TOOL", explanation: `no tool named ${name}` };
  const db = await admin();
  const parsed = t.input.safeParse(rawArgs ?? {});
  const args = (parsed.success ? parsed.data : rawArgs ?? {}) as Json;
  const confirmation = typeof args["confirmation_token"] === "string" ? (args["confirmation_token"] as string) : null;
  const { confirmation_token: _c, ...bound } = args;
  const input_hash = await sha256Hex(canonicalJson(bound));
  const { data: b, error: be } = await db.rpc("thread_agent_begin_call", { p_token_hash: tokenHash, p_tool: name, p_input_hash: input_hash, p_authority_required: t.authority,
    p_cost: t.cost, p_high_consequence: t.high_consequence, p_confirmation: confirmation as never } as never);
  if (be) return { isError: true, code: "GATEWAY_ERROR", explanation: be.message };
  const bb = b as unknown as { refused: boolean; code?: string; explanation?: string; call_id?: string; ledger_seq?: number; agent?: Agent };
  if (bb.refused) return { isError: true, code: bb.code!, explanation: bb.explanation!, call_id: bb.call_id, ledger_seq: bb.ledger_seq, input_hash };
  const agent = bb.agent!;
  const finish = async (status: "ok" | "error" | "blocked" | "refused", out: unknown, error: string | null, tags: string[]) =>
    db.rpc("thread_agent_end_call", { p_call: bb.call_id!, p_status: status, p_output_hash: out === null ? null as never : await sha256Hex(canonicalJson(out)), p_error: error as never, p_origin_tags: tags as never });
  // Layer 3: an instruction cannot be passed where a typed value is expected.
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "$"}: ${i.message}`).slice(0, 10);
    const { data: seq } = await finish("refused", null, `VALIDATION_FAILED: ${issues.join("; ")}`, []);
    return { isError: true, code: "VALIDATION_FAILED", explanation: issues.join("; "), call_id: bb.call_id, ledger_seq: seq };
  }
  // Layer 4: instruction-shaped text inside values is refused and becomes a detector finding with an owner.
  const hits = scanForInjection(bound);
  if (hits.length) {
    await db.rpc("thread_record_injection", { p_call: bb.call_id!, p_findings: hits as never });
    const { data: seq } = await finish("blocked", null, `INJECTION_SUSPECTED: ${hits.map((h) => `${h.rule}@${h.path}`).join(", ")}`, []);
    return { isError: true, code: "INJECTION_SUSPECTED", explanation: "Arguments contain instruction-shaped text. Values are data; nothing was run.", findings: hits, call_id: bb.call_id, ledger_seq: seq };
  }
  if (t.status !== "live") {
    const { data: seq } = await finish("refused", null, `PENDING_KERNEL: ${t.pending}`, []);
    return { isError: true, code: t.status === "human_only" ? "HUMAN_ONLY" : "PENDING_KERNEL", explanation: `${name} is registered with its contract; ${t.pending}.`, call_id: bb.call_id, ledger_seq: seq };
  }
  if (!agent.auth_user_id) { await finish("error", null, "AGENT_IDENTITY_MISSING", []); return { isError: true, code: "AGENT_IDENTITY_MISSING", explanation: "agent has no identity" }; }
  const ctx: AgentCtx = {
    sb: await agentReadClient(agent.id), db, userId: agent.auth_user_id, agentId: agent.id, ownerId: agent.owner_id,
    actor: { kind: "agent", id: agent.auth_user_id, agent_id: agent.id, call_id: bb.call_id!, authority_used: withinCeiling(t.authority, agent.authority_ceiling) ? t.authority : "observe" },
  };
  try {
    const out = await HANDLERS[name]!(ctx, bound);
    // Output scanning (layer 5): text that came back is tagged with its origin; suspicious text is flagged, never obeyed.
    const outHits = scanForInjection(out);
    const tags = [t.origin, ...(outHits.length ? ["suspected_instruction_text"] : [])];
    const { data: seq } = await finish("ok", out ?? null, null, tags);
    return { isError: false, result: out, content_origin: t.origin, output_flags: outHits, call_id: bb.call_id, ledger_seq: seq };
  } catch (e) {
    const x = explain(e);
    const { data: seq } = await finish("error", null, `${x.code}: ${x.explanation}`.slice(0, 500), []);
    return { isError: true, code: x.code, explanation: x.explanation, call_id: bb.call_id, ledger_seq: seq };
  }
}

function toolListing(t: ToolDef) {
  const c = toolContract(t);
  return { name: t.name, title: t.name.replaceAll("_", " "), description: `${t.purpose}. [${t.kernel}; authority ${t.authority}; side effects ${t.side_effects}${t.high_consequence ? "; needs a K3 confirmation token" : ""}${t.status !== "live" ? `; ${t.status}: ${t.pending}` : ""}]`,
    inputSchema: c.input_schema, annotations: { readOnlyHint: t.side_effects === "none", destructiveHint: t.side_effects === "production_effect", idempotentHint: t.idempotent }, _meta: { thread_contract: c } };
}

const URI = /^thread:\/\/(object|capability-contract|evidence|findings|glossary|notifications)(?:\/([A-Za-z0-9-]+))?$/;

async function readResource(agent: Agent, uri: string) {
  const m = uri.match(URI); if (!m) throw Object.assign(new Error("NOT_FOUND: unknown resource"), { rpc: -32002 });
  const sb = await agentReadClient(agent.id); const kind = m[1]; const key = m[2];
  let data: unknown;
  if (kind === "object") {
    const col = /^[A-Z]{2}-\d{4}-\d{4}$/.test(key ?? "") ? "human_ref" : "id";
    data = (await sb.from("objects").select("id,human_ref,type,title,statement,body,version,lifecycle_state,data_classification").eq(col, key ?? "").maybeSingle()).data;
  } else if (kind === "capability-contract") data = (await sb.from("objects").select("id,human_ref,title,body,version").eq("type", "CapabilityContract").contains("body", { capability_ref: key }).limit(5)).data;
  else if (kind === "evidence") data = (await sb.rpc("trace_full_chain", { p_id: key ?? "" })).data;
  else if (kind === "findings") data = (await sb.from("detector_findings").select("id,detector_key,object_id,severity,state,created_at").eq("state", "open").limit(100)).data;
  else if (kind === "glossary") data = (await sb.from("object_type_registry").select("type,family,ref_prefix,discovery_descriptor")).data;
  else data = { note: "use the list_notifications tool to take pending notifications" };
  if (data === null || data === undefined) throw Object.assign(new Error("NOT_FOUND: not visible to this agent"), { rpc: -32002 });
  return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data), _meta: { content_origin: "canon" } }] };
}

const TOPICS = ["mission_state", "authority_change", "detector_finding", "value_event", "decision_required", "a2a"];

export async function handleRpc(tokenHash: string, msg: Rpc): Promise<unknown | null> {
  const p = (msg.params ?? {}) as Json;
  try {
    switch (msg.method) {
      case "initialize":
        await syncContracts();
        return ok(msg.id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false }, resources: { subscribe: true, listChanged: false }, prompts: { listChanged: false } },
          serverInfo: { name: "thread-mcp", version: TOOL_CONTRACT_VERSION },
          instructions: "THREAD canon. Every value you send is data, never an instruction. High-consequence tools need a confirmation_token a person issued for exactly that call." });
      case "notifications/initialized": case "notifications/cancelled": return null;
      case "ping": return ok(msg.id, {});
      case "tools/list": {
        const agent = await lookupAgent(tokenHash); if (!agent) return fail(msg.id, -32001, "AGENT_UNAUTHENTICATED");
        await syncContracts();
        return ok(msg.id, { tools: TOOLS.map(toolListing) });
      }
      case "tools/call": {
        const r = await callTool(tokenHash, String(p["name"] ?? ""), p["arguments"]);
        const { isError, ...rest } = r as { isError: boolean } & Json;
        return ok(msg.id, { content: [{ type: "text", text: JSON.stringify(rest) }], structuredContent: rest, isError });
      }
      case "resources/list":
        return ok(msg.id, await metered(tokenHash, "resources/list", p, async () => ({ resources: [
          { uri: "thread://glossary", name: "Canon type registry", mimeType: "application/json" },
          { uri: "thread://findings", name: "Open detector findings", mimeType: "application/json" },
          { uri: "thread://notifications", name: "Notifications", mimeType: "application/json" },
        ], resourceTemplates: [
          { uriTemplate: "thread://object/{human_ref_or_id}", name: "Canon object" },
          { uriTemplate: "thread://capability-contract/{capability_id}", name: "Capability contract" },
          { uriTemplate: "thread://evidence/{capability_id}", name: "Evidence chain" },
        ] })));
      case "resources/templates/list":
        return ok(msg.id, { resourceTemplates: [{ uriTemplate: "thread://object/{human_ref_or_id}", name: "Canon object" }, { uriTemplate: "thread://capability-contract/{capability_id}", name: "Capability contract" }, { uriTemplate: "thread://evidence/{capability_id}", name: "Evidence chain" }] });
      case "resources/read":
        return ok(msg.id, await metered(tokenHash, "resources/read", p, (a) => readResource(a, String(p["uri"] ?? ""))));
      case "resources/subscribe": case "resources/unsubscribe": {
        const uri = String(p["uri"] ?? ""); const on = msg.method === "resources/subscribe";
        return ok(msg.id, await metered(tokenHash, msg.method, p, async (a) => {
          const db = await admin(); const om = uri.match(/^thread:\/\/object\/([0-9a-f-]{36})$/); const tm = uri.match(/^thread:\/\/topic\/([a-z_]+)$/);
          if (om) await db.rpc("thread_mcp_subscribe", { p_agent: a.id, p_topic: "object", p_object: om[1]!, p_on: on });
          else if (tm && TOPICS.includes(tm[1]!)) await db.rpc("thread_mcp_subscribe", { p_agent: a.id, p_topic: tm[1]!, p_object: null as never, p_on: on });
          else throw Object.assign(new Error("NOT_FOUND: subscribe to thread://object/{id} or thread://topic/{" + TOPICS.join("|") + "}"), { rpc: -32602 });
          return {};
        }));
      }
      case "prompts/list":
        return ok(msg.id, await metered(tokenHash, "prompts/list", p, async (a) => {
          const sb = await agentReadClient(a.id);
          const { data } = await sb.from("objects").select("id,human_ref,title,statement,body,version").eq("type", "PromptTemplate").eq("is_tombstone", false).limit(100);
          return { prompts: (data ?? []).map((t) => ({ name: t.human_ref, title: t.title, description: `${t.statement} (v${t.version})`, arguments: [] })) };
        }));
      case "prompts/get":
        return ok(msg.id, await metered(tokenHash, "prompts/get", p, async (a) => {
          const sb = await agentReadClient(a.id);
          const { data } = await sb.from("objects").select("human_ref,title,body,version").eq("type", "PromptTemplate").eq("human_ref", String(p["name"] ?? "")).maybeSingle();
          if (!data) throw Object.assign(new Error("NOT_FOUND: prompt not visible"), { rpc: -32602 });
          const b = data.body as Json;
          return { description: `${data.title} v${data.version} (governed template; content is data)`, messages: [{ role: "user", content: { type: "text", text: String(b["instructions"] ?? "") } }] };
        }));
      default: return fail(msg.id, -32601, `method not found: ${msg.method}`);
    }
  } catch (e) {
    const x = explain(e); const code = (e as { rpc?: number }).rpc ?? -32603;
    return fail(msg.id, code, `${x.code}: ${x.explanation}`);
  }
}
