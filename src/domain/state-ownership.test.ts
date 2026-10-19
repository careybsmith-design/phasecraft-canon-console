import { describe, expect, it } from "vitest";
import { allStates, LIFECYCLE_FAMILIES } from "./lifecycle";
import { REGISTRY } from "./registry";

// L-08 / AW-16: THREAD owns the thread, not the state. No lifecycle family may carry
// platform execution states; a BuildRun is an evidence record of a platform build.
const EXECUTION_STATES = /^(running|deploying|building|in_progress|queued|released)$/i;

describe("L-08: no THREAD-owned execution state", () => {
  it("no lifecycle family names a live execution state", () => {
    for (const f of Object.keys(LIFECYCLE_FAMILIES) as Array<keyof typeof LIFECYCLE_FAMILIES>)
      for (const s of allStates(f)) expect(s).not.toMatch(EXECUTION_STATES);
  });
  it("the creation run family carries lineage only (compiled, dispatched, superseded)", () => {
    expect(allStates("creation_run").sort()).toEqual(["compiled", "dispatched", "superseded"]);
  });
  it("BuildRun is an evidence record, not an execution lifecycle", () => {
    const br = REGISTRY.find((r) => r.type === "BuildRun");
    expect(br?.lifecycle_family).toBe("evidence_record");
    expect(br?.purpose ?? "").toMatch(/platform/i);
  });
});
