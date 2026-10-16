/**
 * FeatureFlags adapter contract (Section 3.4): progressive exposure and the kill switch.
 */
export interface FeatureFlags {
  mode: "simulated" | "live";
  setExposure(capabilityId: string, populationPct: number, segments: string[]): Promise<{ applied_at: string }>;
  /** Stops a live exposure. Must complete within the stated bound (KILL_SWITCH_BOUND_MS). */
  killSwitch(capabilityId: string): Promise<{ stopped_at: string }>;
  currentExposure(capabilityId: string): Promise<{ population_pct: number; live: boolean }>;
}
