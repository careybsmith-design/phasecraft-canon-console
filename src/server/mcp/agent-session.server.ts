/**
 * Each agent is its own identity: a sign-in-less account (member role) whose session we mint server-side,
 * so every read runs under the same row-level permissions as a person with that role (12.4: filtered at retrieval).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const cache = new Map<string, { token: string; exp: number }>();

function publicClient(bearer?: string) {
  const url = process.env["SUPABASE_URL"]!; const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (bearer) h.set("Authorization", `Bearer ${bearer}`);
        else if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const agentEmail = (agentId: string) => `agent-${agentId}@agents.thread.invalid`;

export async function createAgentIdentity(agentId: string, name: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: agentEmail(agentId), email_confirm: true, app_metadata: { thread_agent: true, agent_id: agentId }, user_metadata: { display_name: name },
  });
  if (error || !data.user) throw new Error(`AGENT_IDENTITY_FAILED: ${error?.message ?? "no user"}`);
  return data.user.id;
}

export async function agentReadClient(agentId: string): Promise<SupabaseClient<Database>> {
  const hit = cache.get(agentId);
  if (hit && hit.exp > Date.now() + 60_000) return publicClient(hit.token);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email: agentEmail(agentId) });
  const hashed = link.data?.properties?.hashed_token;
  if (link.error || !hashed) throw new Error(`AGENT_SESSION_FAILED: ${link.error?.message ?? "no token"}`);
  const v = await publicClient().auth.verifyOtp({ type: "magiclink", token_hash: hashed });
  const s = v.data.session;
  if (v.error || !s) throw new Error(`AGENT_SESSION_FAILED: ${v.error?.message ?? "no session"}`);
  cache.set(agentId, { token: s.access_token, exp: (s.expires_at ?? 0) * 1000 });
  return publicClient(s.access_token);
}
