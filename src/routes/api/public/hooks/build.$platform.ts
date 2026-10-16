/**
 * BuildPlatform webhook (Section 3.4). Public route: the caller is verified by HMAC-SHA256 of the raw body
 * with BUILD_WEBHOOK_SECRET_<PLATFORM> (header x-thread-signature: hex). Unsigned or mis-signed calls get 401.
 */
import { createFileRoute } from "@tanstack/react-router";
import { PLATFORMS, type Platform } from "@/domain/creation";
import { boundedText } from "@/domain/hardening";
import { z } from "zod";

const Result = z.object({ run_id: z.string().uuid(), external_run_id: z.string().trim().min(1).max(200),
  status: z.enum(["succeeded", "failed"]), cost: z.number().finite().nonnegative().optional(), duration_ms: z.number().int().nonnegative().optional(),
  secrets_scan: z.string().max(200).optional(), failure_reason: z.string().max(2000).optional(),
  artifacts: z.array(z.object({ kind: z.string().min(1).max(100), uri: z.string().url(), hash: z.string().min(1).max(200),
    commit: z.string().max(200).optional(), repository: z.string().max(2000).optional(), diff_ref: z.string().max(2000).optional(),
    files_changed: z.array(z.string().max(500)).max(1000).optional() }).passthrough()).max(100).default([]),
}).strict();

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const Route = createFileRoute("/api/public/hooks/build/$platform")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const platform = params.platform as Platform;
        if (!PLATFORMS.includes(platform)) return new Response("unknown platform", { status: 404 });
        const secret = process.env[`BUILD_WEBHOOK_SECRET_${platform.toUpperCase()}`];
        if (!secret) return new Response("platform not connected", { status: 503 });
        let body: string;
        try { body = await boundedText(request); } catch { return new Response("payload exceeds transport limit", { status: 413 }); }
        const sig = request.headers.get("x-thread-signature") ?? "";
        if (!same(sig, await hmacHex(secret, body))) return new Response("bad signature", { status: 401 });
        let j: z.infer<typeof Result>;
        try { j = Result.parse(JSON.parse(body)); } catch { return new Response("invalid build result", { status: 400 }); }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: run } = await supabaseAdmin.from("build_runs").select("platform,external_run_id,adapter_mode").eq("object_id", j.run_id).maybeSingle();
        if (!run || run.platform !== platform || run.adapter_mode !== "live") return new Response("unknown run", { status: 404 });
        if (run.external_run_id && j.external_run_id !== run.external_run_id) return new Response("external run mismatch", { status: 409 });
        const { error } = await supabaseAdmin.rpc("thread_receive_build_result", {
          p_actor: { kind: "system", id: `build-platform:${platform}`, authority_used: "observe" }, p_platform: platform,
          p: { run_id: j.run_id, external_run_id: j.external_run_id, status: j.status, cost_actual: j.cost, duration_ms: j.duration_ms, secrets_scan: j.secrets_scan, failure_reason: j.failure_reason, artifacts: j.artifacts ?? [] },
        } as never);
        if (error) return new Response("build result rejected", { status: 409 });
        return Response.json({ ok: true });
      },
    },
  },
});
