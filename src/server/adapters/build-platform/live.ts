/**
 * Live BuildPlatform: a plain HTTP client per platform, enabled only when BUILD_PLATFORM_<P>_URL and _TOKEN exist.
 * The platform posts results back to /api/public/hooks/build/:platform signed with BUILD_WEBHOOK_SECRET_<P>.
 * Least privilege (8.3): only the compiled prompt and pinned key leave THREAD — never production credentials or data.
 */
import type { Platform } from "@/domain/creation";
import type { Artifact, BuildPlatform, BuildStatus } from "./contract";

export function liveConfig(platform: Platform): { url: string; token: string } | null {
  const k = platform.toUpperCase();
  const url = process.env[`BUILD_PLATFORM_${k}_URL`];
  const token = process.env[`BUILD_PLATFORM_${k}_TOKEN`];
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

export function liveBuildPlatform(platform: Platform, cfg: { url: string; token: string }): BuildPlatform {
  const call = async (path: string, init?: RequestInit) => {
    const res = await fetch(`${cfg.url}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` } });
    if (!res.ok) throw new Error(`PLATFORM_UNAVAILABLE: ${platform} returned ${res.status}`);
    return res.json();
  };
  return {
    mode: "live",
    async dispatch(req) {
      const j = await call("/runs", { method: "POST", body: JSON.stringify({ prompt_id: req.prompt_id, prompt: req.compiled_prompt, repro_key: req.repro_key, cost_ceiling: req.cost_ceiling }) });
      return { external_run_id: String(j.id) };
    },
    async status(id): Promise<BuildStatus> {
      const j = await call(`/runs/${encodeURIComponent(id)}`);
      return { state: j.state, cost: j.cost ?? null, duration_ms: j.duration_ms ?? null, failure_reason: j.failure_reason, secrets_scan: j.secrets_scan ?? "not_run" };
    },
    async fetchArtifacts(id): Promise<Artifact[]> {
      const j = await call(`/runs/${encodeURIComponent(id)}/artifacts`);
      return (j.artifacts ?? []) as Artifact[];
    },
  };
}
