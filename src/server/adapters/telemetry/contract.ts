/**
 * Telemetry adapter contract (Section 3.4). The shadow tap is structurally read-only:
 * a shadow capability can never write back to production (Part 9.2).
 */
export interface ShadowEvent {
  case_ref: string;
  occurred_at: string;
  input_summary: string;
  actual_decision: string;
  actual_outcome?: string;
}

export interface Telemetry {
  mode: "simulated" | "live";
  subscribe(capabilityId: string, filters: Record<string, unknown>): Promise<{ subscription_id: string }>;
  /** Read-only shadow tap. `read_only` is literal true; a live adapter must refuse anything else. */
  tap(opts: { read_only: true; capability_id: string; sample_size: number }): Promise<ShadowEvent[]>;
  metrics(query: { capability_id: string; from: string; to: string }): Promise<{ events_processed: number; cost: number }>;
}
