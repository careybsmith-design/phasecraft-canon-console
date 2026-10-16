/**
 * Simulated FeatureFlags adapter: in-memory exposure state, instant kill switch.
 * Marked simulated; it can never authorise a real exposure (3.4).
 */
import type { FeatureFlags } from "./contract";

export function simulatedFeatureFlags(): FeatureFlags {
  const state = new Map<string, { population_pct: number; live: boolean }>();
  return {
    mode: "simulated",
    async setExposure(capabilityId, populationPct) {
      state.set(capabilityId, { population_pct: populationPct, live: true });
      return { applied_at: new Date().toISOString() };
    },
    async killSwitch(capabilityId) {
      const cur = state.get(capabilityId);
      state.set(capabilityId, { population_pct: 0, live: false });
      return { stopped_at: new Date(Date.now() + (cur?.live ? 50 : 0)).toISOString() };
    },
    async currentExposure(capabilityId) {
      return state.get(capabilityId) ?? { population_pct: 0, live: false };
    },
  };
}
