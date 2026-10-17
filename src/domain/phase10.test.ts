import { describe, expect, it } from "vitest";
import { actionRatios, DETECTION_RULES, elapsedHours, evaluateFacts, median, rejectedMeasure, VALUEOS_DETECTORS } from "./detection";
import { TOOL_BY_NAME } from "./mcp-tools";
import { prohibitedInference } from "./generation";
describe("Phase 10 deterministic detectors", () => {
  it("registers all fifteen ValueOS failure modes", () => expect(VALUEOS_DETECTORS).toHaveLength(15));
  for (const [key, fact] of DETECTION_RULES) it(`induces ${key} and clears its evidence condition`, () => {
    expect(evaluateFacts({ [fact]: true })).toEqual([key]);
    expect(evaluateFacts({ [fact]: false })).toEqual([]);
  });
  for (const term of ["story points", "sprint velocity", "requirements completed", "features shipped without outcome evidence", "lines of code", "prompt count", "agent-call count", "utilisation as a proxy for value", "meetings held", "documents produced", "training modules completed"])
    it(`refuses the rejected measure ${term}`, () => expect(rejectedMeasure(term)).toBe(true));
  it("allows outcome measures", () => expect(rejectedMeasure("median intent-to-value time and operating cost")).toBe(false));
  it("never supplies AW-5 defaults while Carey has not decided", () => {
    const r = actionRatios([{ mutating_actions: 1, reads: 2 }, { mutating_actions: 0, reads: 1 }], { status: "open", value: null });
    expect(r).toEqual({ action_pct: 50, read_only_pct: 50, status: "THRESHOLD_UNSET", pass: false });
  });
  it("uses the Section 18 set status without creating a threshold default", () => {
    const rows = [{ mutating_actions: 1, reads: 2 }, { mutating_actions: 0, reads: 1 }];
    expect(actionRatios(rows, { status: "set", value: { min_action_pct: 50, max_read_only_pct: 50 } })).toMatchObject({ status: "measured", pass: true });
    expect(actionRatios(rows, { status: "set", value: { min_action_pct: 51, max_read_only_pct: 50 } }).pass).toBe(false);
    expect(actionRatios(rows, { status: "open", value: { min_action_pct: 50, max_read_only_pct: 50 } }).status).toBe("THRESHOLD_UNSET");
  });
  it("computes confirmed intent to value time from exact instants", () => expect(elapsedHours("2026-10-01T12:00:00Z", "2026-10-03T18:00:00Z")).toBe(54));
  it("rejects backwards temporal evidence", () => expect(elapsedHours("2026-10-03T18:00:00Z", "2026-10-01T12:00:00Z")).toBeNull());
  it("reports an unmeasured median as null", () => expect(median([])).toBeNull());
  it("computes the median, not the mean", () => expect(median([54, 2, 100, 4])).toBe(29));
  for (const tool of ["resolve_finding", "measure_flow", "measure_value", "measure_capability_health", "measure_community", "get_intent_to_value_time"])
    it(`${tool} is available to the agent gateway`, () => expect(TOOL_BY_NAME.get(tool)?.status).toBe("live"));
  it("refuses a query ranking employees by activity", () => expect(prohibitedInference("rank employees by message volume")).not.toBeNull());
});