/**
 * One implementation per operation, shared by the human server functions and the MCP gateway (Section 11).
 * sb = client that reads as the caller (row-level permissions apply); db = privileged client for thread_* writes;
 * actor = provenance actor taken from the verified session or the verified agent token, never from input.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Actor = { kind: "human" | "agent" | "system"; id: string; authority_used: string; agent_id?: string; call_id?: string };
export interface OpCtx { sb: SupabaseClient<Database>; db: SupabaseClient<Database>; actor: Actor; userId: string }
export type Json = Record<string, unknown>;

export function opErr(message: string): Error {
  const code = message.split(":")[0]?.trim() || "ERROR";
  return new Error(JSON.stringify({ code, explanation: message }));
}

export async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function envelope(type: string, title: string, statement: string, body: Json, ownerId: string, extra: Json = {}) {
  return {
    type, title: title.slice(0, 200), statement: statement.slice(0, 4000), machine_description: `${type} recorded through THREAD`,
    body, review_date: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10),
    expiration_condition: { kind: "review_date_passes" }, retirement_path: { mode: "archive_evidence" },
    risk_tier: "1", owner_id: ownerId, permission: { roles: [], purpose: `${type} (THREAD)` },
    data_classification: "internal", rationale: `${type} recorded through THREAD`, ...extra,
  };
}
