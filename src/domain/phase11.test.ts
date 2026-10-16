import { describe, expect, it } from "vitest";
import { BURST_PHASES, BurstInput, MissionInput, SIMULATION_CRITERIA, SIMULATION_ROLES, behaviouralChallenge, missionSentence, nextScenario, substantiveBurstOutput } from "./human-surfaces";

const base = { signal_id: "00000000-0000-4000-8000-000000000001", title: "Claims waiting", measurable_condition: "claim waiting time", baseline: "9 days", target: "3 days", affected_population: "eligible claims", operating_boundaries: "read-only shadow first", proof_required: "live claims timestamps", co_creator: "00000000-0000-4000-8000-000000000002", builder: "00000000-0000-4000-8000-000000000003", decision_authority: "claims decision mandate", stop_conditions: "privacy breach", maximum_investment: 200, review_date: "2026-11-01", value_hypothesis: "less waiting" };
describe("Phase 11 operating rules", () => {
  it("mission formula preserves condition, baseline, target, population, boundaries and proof", () => expect(missionSentence(base)).toBe("Change claim waiting time from 9 days to 3 days for eligible claims within read-only shadow first, proven by live claims timestamps."));
  it("cell requires two distinct humans", () => expect(MissionInput.safeParse({ ...base, builder: base.co_creator }).success).toBe(false));
  it("mission requires production proof", () => expect(MissionInput.safeParse({ ...base, proof_required: "" }).success).toBe(false));
  it("mission requires an empowered Co-Creator", () => expect(MissionInput.safeParse({ ...base, decision_authority: "" }).success).toBe(false));
  it("investment cannot be negative", () => expect(MissionInput.safeParse({ ...base, maximum_investment: -1 }).success).toBe(false));
  it("burst reference spans 60 to 180 minutes", () => {
    expect(BurstInput.safeParse({ cell_id: base.signal_id, minutes: 59 }).success).toBe(false);
    expect(BurstInput.safeParse({ cell_id: base.signal_id, minutes: 181 }).success).toBe(false);
    expect(BurstInput.parse({ cell_id: base.signal_id, minutes: 60 }).minutes).toBe(60);
    expect(BurstInput.parse({ cell_id: base.signal_id, minutes: 180 }).phases).toEqual(BURST_PHASES);
  });
  it("discussion alone is not a burst output", () => expect(substantiveBurstOutput({ type: "Lesson", lifecycle_state: "active", body: {} })).toBe(false));
  it("draft capability is not a burst output", () => expect(substantiveBurstOutput({ type: "WorkingCapability", lifecycle_state: "draft", body: {} })).toBe(false));
  it("simulated production does not satisfy burst production evidence", () => expect(substantiveBurstOutput({ type: "ProductionOutcome", lifecycle_state: "recorded", body: { adapter_mode: "simulated" } })).toBe(false));
  it("live production evidence is substantive", () => expect(substantiveBurstOutput({ type: "ProductionOutcome", lifecycle_state: "recorded", body: { adapter_mode: "live" } })).toBe(true));
  it("a consequential decision is substantive", () => expect(substantiveBurstOutput({ type: "ConfirmedDecision", lifecycle_state: "recorded", body: { decision: "stop unsafe exposure" } })).toBe(true));
  it("an eliminated assumption is substantive", () => expect(substantiveBurstOutput({ type: "Assumption", lifecycle_state: "confirmed", body: { disproved: true } })).toBe(true));
  it("simulation has eight evaluation criteria, not a completion score", () => expect(SIMULATION_CRITERIA).toHaveLength(8));
  it("simulation portrays all seven specified roles", () => expect(SIMULATION_ROLES).toHaveLength(7));
  it("scenario adapts to an outcome-first response", () => { expect(nextScenario("", 0).prompt).toMatch(/observable condition/); expect(nextScenario("agree outcome condition", 1).prompt).toMatch(/evidence and baseline/); });
  it("a requested app receives outcome-first challenge", () => expect(behaviouralChallenge("Build a new customer-service application")).toMatch(/measurable condition/));
});