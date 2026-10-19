/** BuildPlatform contract (Section 3.4) for lovable, claude_code, codex, cursor, grok. */
import type { Platform } from "@/domain/creation";

export interface DispatchRequest {
  platform: Platform;
  prompt_id: string;
  run_id: string;
  compiled_prompt: string;
  compiled_hash: string;
  repro_key: {
    model_version: string;
    template_version: string;
    guardrail_set_version: string;
    [k: string]: unknown;
  };
  cost_ceiling: number;
}
export interface BuildStatus {
  state: "running" | "succeeded" | "failed";
  cost: number | null;
  duration_ms: number | null;
  failure_reason?: string;
  secrets_scan: "clean" | string;
}
export interface Artifact {
  kind: string;
  uri: string;
  hash: string;
  commit?: string;
  repository?: string;
  diff_ref?: string;
  files_changed?: string[];
}

export interface BuildPlatform {
  mode: "live" | "simulated";
  dispatch(req: DispatchRequest): Promise<{ external_run_id: string }>;
  status(external_run_id: string): Promise<BuildStatus>;
  fetchArtifacts(external_run_id: string): Promise<Artifact[]>;
}
