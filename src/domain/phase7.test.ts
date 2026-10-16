import { describe, expect, it } from "vitest";
import {
  CAUSE_CLASSES, DISCREPANCY_RATE_THRESHOLD, EXPOSURE_STEPS, KILL_SWITCH_BOUND_MS,
  clusterCauses, decisionsDiffer, discrepancyRate, exposureStepError, incidentDemotes,
  killSwitchWithinBound, nextExposureStep, rateBreaches, unownedClasses, type ShadowCase,
} from "./shadow";

const dc = (cause: ShadowCase["hypothesised_cause"], ref: string): ShadowCase =>
  ({ case_ref: ref, shadow_decision: "approve", actual_decision: "escalate", hypothesised_cause: cause });

describe("Phase 7 shadow comparison (Part 9)", () => {
  it("a case is a discrepancy only when shadow and actual decisions differ", () => {
    expect(decisionsDiffer("approve", "approve")).toBe(false);
    expect(decisionsDiffer("approve", "escalate")).toBe(true);
    expect(decisionsDiffer(" approve ", "approve")).toBe(false);
  });
  it("discrepancy rate needs a positive sample and a count within it", () => {
    expect(discrepancyRate(200, 4)).toBe(0.02);
    expect(() => discrepancyRate(0, 0)).toThrow("SAMPLE_SIZE_REQUIRED");
    expect(() => discrepancyRate(10, 11)).toThrow("BAD_DISCREPANCY_COUNT");
  });
  it("a rate above the threshold breaches the bound; at the threshold it does not", () => {
    expect(rateBreaches(DISCREPANCY_RATE_THRESHOLD)).toBe(false);
    expect(rateBreaches(DISCREPANCY_RATE_THRESHOLD + 0.001)).toBe(true);
  });
  it("clusters discrepancies by cause, largest first", () => {
    const clusters = clusterCauses([dc("model_error", "C1"), dc("edge_case", "C2"), dc("model_error", "C3")]);
    expect(clusters[0]).toEqual({ cause: "model_error", count: 2, case_refs: ["C1", "C3"] });
    expect(clusters[1]!.cause).toBe("edge_case");
  });
  it("every cause class above threshold is surfaced for an owner and disposition", () => {
    const clusters = clusterCauses([...Array(5)].map((_, i) => dc("policy_gap", `P${i}`)).concat([dc("unknown", "U1")]));
    expect(unownedClasses(clusters, 100)).toEqual(["policy_gap"]);
    expect(CAUSE_CLASSES).toContain("unknown");
  });
});

describe("Phase 7 progressive exposure (Part 9.2)", () => {
  it("exposure advances one step at a time", () => {
    expect(nextExposureStep(0)).toBe(1);
    expect(nextExposureStep(1)).toBe(5);
    expect(nextExposureStep(100)).toBeNull();
    expect(EXPOSURE_STEPS[EXPOSURE_STEPS.length - 1]).toBe(100);
  });
  it("refuses leaps, reversals and repeats", () => {
    expect(exposureStepError(0, 5)).toContain("EXPOSURE_STEP_SKIPPED");
    expect(exposureStepError(5, 5)).toContain("EXPOSURE_NOT_PROGRESSIVE");
    expect(exposureStepError(25, 5)).toContain("EXPOSURE_NOT_PROGRESSIVE");
    expect(exposureStepError(100, 100)).toContain("EXPOSURE_COMPLETE");
    expect(exposureStepError(5, 25)).toBeNull();
  });
});

describe("Phase 7 incidents and kill switch (6.2, 9.2)", () => {
  it("a critical incident demotes; a repeated serious one demotes; a single minor does not", () => {
    expect(incidentDemotes("critical", 0)).toBe(true);
    expect(incidentDemotes("major", 2)).toBe(true);
    expect(incidentDemotes("major", 1)).toBe(false);
    expect(incidentDemotes("minor", 1)).toBe(false);
  });
  it("the kill switch must stop within its stated bound", () => {
    expect(killSwitchWithinBound(1000, 1000 + KILL_SWITCH_BOUND_MS)).toBe(true);
    expect(killSwitchWithinBound(1000, 1000 + KILL_SWITCH_BOUND_MS + 1)).toBe(false);
  });
});
