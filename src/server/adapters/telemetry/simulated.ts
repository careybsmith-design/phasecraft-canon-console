/**
 * Simulated Telemetry adapter: deterministic, seeded events. Everything it produces is marked
 * simulated and can never count toward promotion, exposure authorisation or value measures (3.4).
 */
import type { ShadowEvent, Telemetry } from "./contract";

export function simulatedTelemetry(seed = 7): Telemetry {
  return {
    mode: "simulated",
    async subscribe(capabilityId) {
      return { subscription_id: `sim-sub-${capabilityId.slice(0, 8)}` };
    },
    async tap({ capability_id, sample_size }) {
      const events: ShadowEvent[] = [];
      for (let i = 0; i < sample_size; i++) {
        const n = (seed * 31 + i * 17) % 100;
        events.push({
          case_ref: `SIM-${capability_id.slice(0, 8)}-${String(i).padStart(4, "0")}`,
          occurred_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
          input_summary: `simulated event ${i}`,
          actual_decision: n < 3 ? "escalate" : "approve",
          actual_outcome: n < 3 ? "human handled" : "no complaint",
        });
      }
      return events;
    },
    async metrics() {
      return { events_processed: 0, cost: 0 };
    },
  };
}
