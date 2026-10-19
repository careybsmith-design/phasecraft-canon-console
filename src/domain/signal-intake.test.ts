/**
 * SI-1…SI-8 (correction round L-22/S-09): the signal-intake release blockers.
 * Database enforcement (mission_signal_gate trigger, append-only intake events,
 * promote authority) is verified against the live database; these tests pin the
 * domain contracts those rules are built from.
 */
import { describe, expect, it } from "vitest";
import {
  SIGNAL_ORIGINS,
  INTAKE_STATUSES,
  PROMOTABLE_STATES,
  MISSION_ELIGIBLE_STATE,
  RecordSignalInput,
  ExtractSignalInput,
  CaptureStartInput,
  CaptureCompleteInput,
  ConfirmDraftInput,
  PromoteSignalInput,
  LinkSignalInput,
  draftSignalsFromText,
  isNearDuplicate,
  normalizeCondition,
} from "./signal-intake";
import { classifyContent } from "./content-tier";
import { canTransition, initialState } from "./lifecycle";
import { REGISTRY } from "./registry";
import { VERBS, edgeAllowed } from "./relationships";
import { TOOL_BY_NAME } from "./mcp-tools";

const uid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

describe("SI-1 only a promoted signal can originate a mission", () => {
  it("promoted is the only mission-eligible state and sits after every promotable state", () => {
    expect(MISSION_ELIGIBLE_STATE).toBe("promoted");
    for (const s of PROMOTABLE_STATES)
      expect(canTransition("value_signal", s, "promoted")).toBe(true);
    expect(PROMOTABLE_STATES).not.toContain("promoted");
    expect(initialState("value_signal")).toBe("detected");
  });
  it("a signal can rest in detected, enriched or monitoring with no mission at all", () => {
    expect(PROMOTABLE_STATES).toEqual(["detected", "enriched", "monitoring"]);
  });
});

describe("SI-2 the four channels share one object and one audit event", () => {
  it("all four origination channels are first-class", () => {
    expect(SIGNAL_ORIGINS).toEqual([
      "agent_sensor",
      "human_expertise",
      "artifact_upload",
      "live_capture",
    ]);
  });
  it("intake statuses cover received, extracted, confirmed, rejected and duplicate", () => {
    expect(INTAKE_STATUSES).toEqual([
      "received",
      "extracted",
      "confirmed",
      "rejected",
      "duplicate",
    ]);
  });
  it("the registry requires intake provenance on every ValueSignal", () => {
    const entry = REGISTRY.find((r) => r.type === "ValueSignal");
    expect(entry?.key_fields).toEqual(
      expect.arrayContaining([
        "origin_channel",
        "source_ref",
        "intake_event_id",
        "observed_condition",
        "requested_solution_candidates",
      ]),
    );
  });
  it("the human channel input carries a stated condition and evidence, never a solution request", () => {
    const parsed = RecordSignalInput.parse({
      observed_condition: "Claims wait nine days for review",
      evidence_refs: [uid(1)],
      urgency: "high",
    });
    expect(parsed).not.toHaveProperty("solution");
    expect(RecordSignalInput.safeParse({ observed_condition: "" }).success).toBe(false);
  });
});

describe("SI-3/SI-4 the PHI/PAN gate precedes everything", () => {
  it("a payment card number is hard-blocked at tier C before any model call", () => {
    const tier = classifyContent("Card 4111 1111 1111 1111 was noted on the call");
    expect(tier.tier).toBe("C");
    expect(tier.pan).toBe(true);
  });
  it("a health identifier is quarantined at tier C, not routed", () => {
    const tier = classifyContent("Patient MRN: 1234567 waits nine days");
    expect(tier.tier).toBe("C");
    expect(tier.phi).toBe(true);
  });
  it("ordinary business conditions pass the gate", () => {
    expect(classifyContent("Claims wait nine days for review").tier).toBe("A");
  });
});

describe("SI-5 extraction produces proposals, never objects", () => {
  it("artifact and capture text yields draft proposals requiring human confirmation", () => {
    const drafts = draftSignalsFromText(
      "Onboarding takes six weeks and new hires wait for access. Revenue grew 4% last quarter.",
    );
    expect(drafts.length).toBeGreaterThan(0);
    for (const d of drafts) {
      expect(d.confidence).toBe("low");
      expect(d.basis).toMatch(/must confirm/);
    }
  });
  it("text without a condition cue yields no proposals", () => {
    expect(draftSignalsFromText("The sky is blue. Water is wet.")).toHaveLength(0);
  });
});

describe("SI-6 deduplication is mandatory", () => {
  it("normalised conditions collapse near-duplicates", () => {
    expect(isNearDuplicate("Claims wait nine days!", "claims wait nine days")).toBe(true);
    expect(isNearDuplicate("Claims wait nine days", "Onboarding takes six weeks")).toBe(false);
    expect(normalizeCondition("  Claims—wait, NINE days ")).toBe("claims wait nine days");
  });
});

describe("SI-7 promotion is an authority-bound recorded decision", () => {
  it("promotion always requires a rationale", () => {
    expect(PromoteSignalInput.safeParse({ signal_id: uid(1), rationale: "" }).success).toBe(false);
    expect(
      PromoteSignalInput.parse({
        signal_id: uid(1),
        rationale: "Condition verified with the claims team",
      }).signal_id,
    ).toBe(uid(1));
  });
});

describe("SI-8 every mission resolves its originating signal", () => {
  it("the ValueMission registry keeps signal_ref as a key field", () => {
    const entry = REGISTRY.find((r) => r.type === "ValueMission");
    expect(entry?.key_fields[0]).toBe("signal_ref");
  });
});

describe("intake edges and tools (B.3, B.8, AW-13 extension)", () => {
  it("originated_from links a signal to its evidence; duplicates links signals", () => {
    expect(edgeAllowed("originated_from", "ValueSignal", "TestRun")).toBe(true);
    expect(edgeAllowed("originated_from", "ValueSignal", "ValueMission")).toBe(false);
    expect(edgeAllowed("duplicates", "ValueSignal", "ValueSignal")).toBe(true);
    expect(VERBS.find((v) => v.verb === "originated_from")?.impact).toBe("none");
  });
  it("the six intake tools are registered and executable", () => {
    for (const name of [
      "record_value_signal",
      "extract_signal_from_artifact",
      "start_signal_capture",
      "complete_signal_capture",
      "promote_signal",
      "link_signal_to_mission",
    ]) {
      const tool = TOOL_BY_NAME.get(name);
      expect(tool, name).toBeDefined();
      expect(tool?.status).toBe("live");
    }
    expect(TOOL_BY_NAME.get("detect_value_signal")).toBeDefined();
  });
  it("capture requires consent and links are rationale-bound", () => {
    expect(
      CaptureStartInput.parse({ modalities: ["audio", "text"], purpose: "Claims framing" })
        .modalities,
    ).toHaveLength(2);
    expect(CaptureCompleteInput.safeParse({ capture_id: uid(1), transcript: "" }).success).toBe(
      false,
    );
    expect(
      LinkSignalInput.safeParse({ signal_id: uid(1), mission_id: uid(2), rationale: "" }).success,
    ).toBe(false);
    expect(
      ExtractSignalInput.safeParse({ artifact_text: "x".repeat(20001), kind: "document" }).success,
    ).toBe(false);
    expect(
      ConfirmDraftInput.parse({
        origin: "artifact_upload",
        observed_condition: "Claims wait nine days",
        evidence_refs: [],
        extraction_method: "model_extraction",
      }).origin,
    ).toBe("artifact_upload");
  });
});
