import { describe, expect, it } from "vitest";
import { actionRatios, DETECTOR_MANIFEST, DETECTION_RULES } from "./detection";
import { APPROVAL_STATE_PATTERN } from "./lifecycle";
import { prohibitedInference } from "./generation";
import { validExtractionSpan } from "./extraction-span";

describe("Correction packet rules", () => {
  it.each([
    null,
    {},
    { kind: "char_range", start: 0, end: 0 },
    { kind: "time_range", start: -1, end: 10 },
    { kind: "region", start: [0, 0], end: [0, 1] },
  ])("L-06 discards unusable span %j", (span) => expect(validExtractionSpan(span)).toBe(false));
  it.each([
    { kind: "char_range", start: 0, end: 10 },
    { kind: "time_range", start: 10, end: 50 },
    { kind: "log_offset", start: 0, end: 1 },
    { kind: "region", start: [0, 0], end: [0.5, 0.5] },
  ])("L-06 accepts bounded span %j", (span) => expect(validExtractionSpan(span)).toBe(true));
  it("L-05 has 36 blocking-capable keys plus one warning", () => {
    expect(DETECTION_RULES).toHaveLength(36);
    expect(DETECTOR_MANIFEST).toHaveLength(37);
    expect(new Set(DETECTOR_MANIFEST).size).toBe(37);
    expect(DETECTOR_MANIFEST).toContain("AntiWikiActionRatioThresholdUnset");
    expect(DETECTOR_MANIFEST).not.toContain("ProhibitedInference");
  });
  it("L-02 OPEN reports 50/50 without blocking", () => {
    expect(
      actionRatios(
        [
          { mutating_actions: 1, reads: 0 },
          { mutating_actions: 0, reads: 1 },
        ],
        { status: "open", value: null },
      ),
    ).toMatchObject({
      action_pct: 50,
      read_only_pct: 50,
      status: "THRESHOLD_UNSET",
      release_blocking: false,
      severity: "warning",
    });
  });
  it("L-02 a configured violation blocks", () => {
    expect(
      actionRatios([{ mutating_actions: 0, reads: 1 }], {
        status: "set",
        value: { min_action_pct: 60, max_read_only_pct: 25 },
      }),
    ).toMatchObject({ pass: false, release_blocking: true });
  });
  it.each([
    "delegated",
    "aggregate",
    "investigate",
    "mitigate",
    "navigate",
    "propagate",
    "segregate",
  ])("L-11 permits %s", (state) => expect(APPROVAL_STATE_PATTERN.test(state)).toBe(false));
  it.each(["pending_review", "awaiting_approval", "submitted_for_review", "gate", "in_qa_phase"])(
    "L-11 refuses %s",
    (state) => expect(APPROVAL_STATE_PATTERN.test(state)).toBe(true),
  );
  it.each([
    "select actor_id, reads from usage_sessions",
    "mutating_actions per actor_id",
    "actor_id\nreads",
  ])("L-10 refuses %s", (text) =>
    expect(prohibitedInference(text)?.key).toBe("actor_activity_fields"),
  );
});
