import { describe, expect, it } from "vitest";
import {
  LIFECYCLE_FAMILIES,
  APPROVAL_STATE_PATTERN,
  allStates,
  canTransition,
  initialState,
  type LifecycleFamily,
} from "./lifecycle";
import { REGISTRY, PROHIBITED_TYPE_PATTERN, discoveryDescriptor } from "./registry";
import { CreateObjectInput } from "./types/envelope";

const families = Object.keys(LIFECYCLE_FAMILIES) as LifecycleFamily[];

describe("Part 4.4 lifecycle", () => {
  it("AW-2: no state anywhere names or means approval, sign-off, review or gate", () => {
    for (const f of families)
      for (const s of allStates(f)) expect(s).not.toMatch(APPROVAL_STATE_PATTERN);
  });
  it("canon moves draft -> active but never back", () => {
    expect(canTransition("canon", "draft", "active")).toBe(true);
    expect(canTransition("canon", "active", "draft")).toBe(false);
  });
  it("value signal ends in promoted, rejected or expired", () => {
    expect(canTransition("value_signal", "monitoring", "promoted")).toBe(true);
    expect(canTransition("value_signal", "promoted", "rejected")).toBe(false);
  });
  it("behaviour statements start proposed", () =>
    expect(initialState("behavior_statement")).toBe("proposed"));
});

describe("Part 4.3 registry", () => {
  it("AW-1: no document, project, backlog or approval type exists", () => {
    for (const r of REGISTRY) expect(r.type).not.toMatch(PROHIBITED_TYPE_PATTERN);
    expect(REGISTRY.some((r) => r.type === "Requirement")).toBe(false);
  });
  it("prefixes and types are unique", () => {
    expect(new Set(REGISTRY.map((r) => r.ref_prefix)).size).toBe(REGISTRY.length);
    expect(new Set(REGISTRY.map((r) => r.type)).size).toBe(REGISTRY.length);
  });
  it("P5: every type has a discovery descriptor", () => {
    for (const r of REGISTRY) expect(discoveryDescriptor(r).purpose.length).toBeGreaterThan(0);
  });
  it("includes the depth-priority and Phase 1 framing types", () => {
    const names = REGISTRY.map((r) => r.type);
    for (const t of [
      "ValueSignal",
      "ValueMission",
      "BehaviorStatement",
      "ExecutableOutcomeContract",
      "CreationPrompt",
      "BuildRun",
      "ExposureAuthorization",
      "ValueMeasure",
      "Rendition",
      "Detector",
      "FramingSession",
      "CoCreationArtifact",
      "ExtractedStatement",
      "NeedStatement",
    ])
      expect(names).toContain(t);
  });
});

describe("P4 envelope input", () => {
  const ok = {
    type: "Concept",
    title: "t",
    statement: "s",
    machine_description: "m",
    review_date: "2027-01-01",
    expiration_condition: { kind: "review_date_passes" },
    retirement_path: { mode: "tombstone" },
    risk_tier: "1",
    permission: { roles: [], purpose: "p" },
    data_classification: "internal",
    rationale: "r",
  };
  it("accepts a complete envelope", () =>
    expect(CreateObjectInput.safeParse(ok).success).toBe(true));
  it("rejects a missing review date", () =>
    expect(CreateObjectInput.safeParse({ ...ok, review_date: undefined }).success).toBe(false));
  it("rejects prohibited-class content", () =>
    expect(CreateObjectInput.safeParse({ ...ok, data_classification: "prohibited" }).success).toBe(
      false,
    ));
});
