import { describe, expect, it } from "vitest";
import {
  CHAIN_LINKS,
  QUESTIONS,
  TRACES,
  canReachCreation,
  capabilityStateError,
  completeness,
} from "./evidence";
import { VERBS } from "./relationships";

describe("Phase 5 evidence graph", () => {
  it("has the eight chain links in Part 5.1 order", () => {
    expect(CHAIN_LINKS.map((l) => l.link)).toEqual([
      "signal",
      "decision",
      "behavior",
      "implement",
      "test",
      "release",
      "outcome",
      "value",
    ]);
  });
  it("has exactly the nine explain_capability questions", () => {
    expect(QUESTIONS.map((q) => q.q).sort()).toEqual([
      "authority",
      "decision",
      "evidence",
      "exposure",
      "justification",
      "outcome",
      "tests",
      "value",
      "version",
    ]);
  });
  it("has the ten traceability queries, each within one second except full chain (1.5 s)", () => {
    expect(TRACES).toHaveLength(10);
    expect(TRACES.find((t) => t.n === 10)?.budget).toBe(1500);
    expect(TRACES.filter((t) => t.n !== 10).every((t) => t.budget <= 1000)).toBe(true);
  });
  it("reports missing links", () => {
    const c = completeness(
      CHAIN_LINKS.map((l, i) => ({ link: l.link, present: i < 6, count: i < 6 ? 1 : 0 })),
    );
    expect(c).toEqual({ present: 6, total: 8, missing: ["outcome", "value"], score: 0.75 });
  });
  it("blocks creation without a Confirmed Decision ancestor", () => {
    expect(canReachCreation("confirmed", false)).toBe(false);
    expect(canReachCreation("proposed", true)).toBe(false);
    expect(canReachCreation("confirmed", true)).toBe(true);
  });
  it("needs authorisation for exposure and a value measure for producing value", () => {
    expect(
      capabilityStateError("limited_exposure", {
        exposureAuthorisation: false,
        valueMeasure: false,
      }),
    ).toBe("EXPOSURE_NOT_AUTHORISED");
    expect(
      capabilityStateError("producing_value", { exposureAuthorisation: true, valueMeasure: false }),
    ).toBe("VALUE_MEASURE_REQUIRED");
    expect(
      capabilityStateError("producing_value", { exposureAuthorisation: true, valueMeasure: true }),
    ).toBeNull();
  });
  it("registers the chain verbs", () => {
    const names = VERBS.map((v) => v.verb);
    for (const v of [
      "decided_from",
      "built",
      "renews",
      "confirmed_by",
      "compiled_into",
      "executed_as",
      "verified_by",
      "authorised_by",
      "observed_as",
      "values",
      "caused",
    ])
      expect(names).toContain(v);
  });
});
