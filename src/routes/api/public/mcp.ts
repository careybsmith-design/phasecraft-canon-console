/**
 * MCP endpoint (Section 3 / 11). Public route: the caller is verified inside the handler by its agent bearer token
 * (sha-256 compared against agents.token_hash in the database). Unknown or revoked tokens get 401.
 */
import { createFileRoute } from "@tanstack/react-router";
import { boundedJson, rpcBatch } from "@/domain/hardening";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const Route = createFileRoute("/api/public/mcp")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () =>
        new Response("This MCP server does not open a server-to-client stream; use POST.", {
          status: 405,
          headers: { Allow: "POST", ...CORS },
        }),
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
        if (!/^thr_[0-9a-f]{64}$/.test(token))
          return new Response(JSON.stringify({ error: "agent bearer token required" }), {
            status: 401,
            headers: { "Content-Type": "application/json", "WWW-Authenticate": "Bearer", ...CORS },
          });
        const { sha256Hex } = await import("@/domain/mcp");
        const tokenHash = await sha256Hex(token);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: agent } = await supabaseAdmin
          .from("agents")
          .select("state")
          .eq("token_hash", tokenHash)
          .maybeSingle();
        if (!agent || agent.state !== "active")
          return new Response(JSON.stringify({ error: "unknown or revoked agent token" }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        let body: unknown;
        try {
          body = await boundedJson(request);
        } catch (error) {
          const oversized = error instanceof Error && error.message === "BODY_LIMIT";
          return Response.json(
            {
              jsonrpc: "2.0",
              id: null,
              error: {
                code: oversized ? -32600 : -32700,
                message: oversized ? "request body exceeds 256 KiB" : "parse error",
              },
            },
            { status: oversized ? 413 : 400, headers: { "Cache-Control": "no-store", ...CORS } },
          );
        }
        const { handleRpc } = await import("@/server/mcp/gateway.server");
        let msgs: unknown[];
        try {
          msgs = rpcBatch(body);
        } catch {
          return Response.json(
            {
              jsonrpc: "2.0",
              id: null,
              error: { code: -32600, message: "batch must contain 1–20 messages" },
            },
            { status: 400, headers: { "Cache-Control": "no-store", ...CORS } },
          );
        }
        const out = [];
        for (const m of msgs) {
          if (
            !m ||
            typeof m !== "object" ||
            typeof (m as { method?: unknown }).method !== "string"
          ) {
            out.push({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32600, message: "invalid request" },
            });
            continue;
          }
          const r = await handleRpc(tokenHash, m as never);
          if (r !== null) out.push(r);
        }
        if (!out.length) return new Response(null, { status: 202, headers: CORS });
        return Response.json(Array.isArray(body) ? out : out[0], {
          headers: { "Cache-Control": "no-store", "MCP-Protocol-Version": "2025-06-18", ...CORS },
        });
      },
    },
  },
});
