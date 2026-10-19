/**
 * Deterministic simulated BuildPlatform. The artifact digest mirrors SQL `_sim_build_digest`, so a replay
 * from the same reproducibility key yields the same artifact. Every run it produces is ledgered as simulated.
 */
import type { Artifact, BuildPlatform, BuildStatus, DispatchRequest } from "./contract";

async function sha256(s: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function simulatedBuildPlatform(): BuildPlatform {
  const runs = new Map<string, { req: DispatchRequest; digest: string }>();
  return {
    mode: "simulated",
    async dispatch(req) {
      const digest = await sha256(
        [
          req.compiled_hash,
          req.platform,
          req.repro_key.model_version,
          req.repro_key.template_version,
          req.repro_key.guardrail_set_version,
        ].join("|"),
      );
      const external_run_id = `sim-${req.platform}-${digest.slice(0, 12)}-${crypto.randomUUID().slice(0, 8)}`;
      runs.set(external_run_id, { req, digest });
      return { external_run_id };
    },
    async status(id): Promise<BuildStatus> {
      const r = runs.get(id);
      if (!r)
        return {
          state: "failed",
          cost: null,
          duration_ms: null,
          failure_reason: "UNKNOWN_RUN",
          secrets_scan: "not_run",
        };
      // deterministic, seeded cost well under the ceiling
      const cost = Math.round((0.2 + (parseInt(r.digest.slice(0, 4), 16) % 100) / 100) * 100) / 100;
      return {
        state: "succeeded",
        cost: Math.min(cost, r.req.cost_ceiling),
        duration_ms: 1000 + (parseInt(r.digest.slice(4, 8), 16) % 4000),
        secrets_scan: "clean",
      };
    },
    async fetchArtifacts(id): Promise<Artifact[]> {
      const r = runs.get(id);
      if (!r) return [];
      return [
        {
          kind: "commit",
          uri: `sim://${r.req.platform}/${r.req.prompt_id}/${r.digest.slice(0, 12)}`,
          hash: r.digest,
          commit: r.digest.slice(0, 12),
          repository: `sim://${r.req.platform}/thread-builds`,
          files_changed: [],
        },
      ];
    },
  };
}
