import { describe, expect, it } from "vitest";
import { edgeAllowed } from "./relationships";
import { LinkSessionMissionInput, intentMissionAdvisory } from "./session-mission";

describe("session mission containment", () => {
  it("preserves mission to cell scope", () =>
    expect(edgeAllowed("scoped_to", "ValueMission", "ValueCell")).toBe(true));
  it("permits session to mission scope", () =>
    expect(edgeAllowed("scoped_to", "FramingSession", "ValueMission")).toBe(true));
  it("preserves mission to signal promotion", () =>
    expect(edgeAllowed("promoted_from", "ValueMission", "ValueSignal")).toBe(true));
  it("permits mission to need promotion", () =>
    expect(edgeAllowed("promoted_from", "ValueMission", "NeedStatement")).toBe(true));
  it("refuses caller supplied authority", () =>
    expect(
      LinkSessionMissionInput.safeParse({
        session_id: "00000000-0000-4000-8000-000000000001",
        mission_id: "00000000-0000-4000-8000-000000000002",
        rationale: "Scope intent",
        authority_used: "autonomous_with_exception",
      }).success,
    ).toBe(false));
  it("advises on confirmed intent without a mission", () =>
    expect(intentMissionAdvisory("BehaviorStatement", "confirmed", null, false, false)).toBe(
      "intent awaiting a mission",
    ));
  it("clears advisory when containment resolves", () =>
    expect(intentMissionAdvisory("NeedStatement", "confirmed", null, true, false)).toBeNull());
  it("requires a promoted signal for a need becoming a mission", () =>
    expect(
      intentMissionAdvisory("NeedStatement", "confirmed", "becomes_mission", false, false),
    ).toBe("intent awaiting a signal"));
  it("does not count a draft as confirmed intent", () =>
    expect(intentMissionAdvisory("BehaviorStatement", "proposed", null, false, false)).toBeNull());
});
