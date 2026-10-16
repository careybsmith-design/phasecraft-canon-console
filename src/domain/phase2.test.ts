import { describe, it, expect } from "vitest";
import { VERBS, edgeAllowed, expandedSignatures } from "./relationships";
import { REGISTRY } from "./registry";
import { applyEdgeBudget, findCycles } from "./graph";

const types = new Set(REGISTRY.map((r) => r.type));

describe("Phase 2 relationship verbs", () => {
  it("every verb signature resolves to registered types", () => {
    for (const v of VERBS) for (const s of expandedSignatures(v)) for (const t of [...s.from, ...s.to]) expect(t === "*" || types.has(t), `${v.verb}: ${t}`).toBe(true);
  });
  it("rejects a verb used between the wrong types", () => {
    expect(edgeAllowed("expresses", "IntentModel", "ValueMission")).toBe(true);
    expect(edgeAllowed("expresses", "Concept", "Principle")).toBe(false);
  });
  it("depends_on links needs to needs and behaviour to behaviour, not across", () => {
    expect(edgeAllowed("depends_on", "NeedStatement", "NeedStatement")).toBe(true);
    expect(edgeAllowed("depends_on", "NeedStatement", "BehaviorStatement")).toBe(false);
  });
  it("affected_by_change is computed and can never be stored", () => {
    expect(edgeAllowed("affected_by_change", "Concept", "Concept")).toBe(false);
  });
});

describe("Phase 2 graph helpers", () => {
  it("states the edge budget honestly", () => {
    expect(applyEdgeBudget(Array.from({ length: 3412 }), 500).label).toBe("showing 500 of 3,412 edges");
  });
  it("finds a depends_on cycle", () => {
    expect(findCycles([{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "c", to: "a" }])).toHaveLength(1);
    expect(findCycles([{ from: "a", to: "b" }, { from: "b", to: "c" }])).toHaveLength(0);
  });
});
