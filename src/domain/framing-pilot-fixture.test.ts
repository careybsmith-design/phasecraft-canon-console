import { expect, it } from "vitest";
import { FRAMING_PILOT_FIXTURE as f } from "./framing-pilot-fixture";
import {
  applyPostRules,
  ruleClassify,
  polarityConflict,
  precisionRecall,
  CLASSES,
  EXTRACT_TYPES,
} from "./framing";
import { validExtractionSpan } from "./extraction-span";
import { canTransition } from "./lifecycle";
it("L-03 recorded diarised fixture publishes per-class and per-type results", () => {
  const rows = f.transcript.map((t) => {
    const speaker = f.participants.find((p) => p.id === t.speaker);
    if (!speaker) throw new Error("Missing speaker");
    return { t, r: applyPostRules(ruleClassify(t.text), speaker, f.participants) };
  });
  const classes = precisionRecall(
    rows.map(({ t, r }) => ({ expected: t.classification, predicted: r.classification })),
    CLASSES,
  );
  const types = precisionRecall(
    rows.map(({ t, r }) => ({ expected: t.type, predicted: r.object_type })),
    EXTRACT_TYPES,
  );
  expect(classes.every((p) => p.support === 0 || p.recall === 1)).toBe(true);
  expect(types.filter((p) => p.support > 0).every((p) => p.recall === 1)).toBe(true);
  expect(rows[1]?.r.authority_mismatch).not.toBeNull();
});
it("L-03 every fixture candidate has a valid span including the whiteboard", () => {
  expect(
    f.transcript.every((t) =>
      validExtractionSpan({ kind: "time_range", start: t.start, end: t.end }),
    ),
  ).toBe(true);
  expect(validExtractionSpan(f.whiteboard.span)).toBe(true);
});
it("L-03 fixture contradiction is detected against prior confirmed intent", () =>
  expect(polarityConflict(f.prior_confirmed, f.transcript[2]?.text ?? "")).toBe(true));
it("L-03 a changed extractor cannot regress a confirmation or advance a draft into generation", () => {
  expect(f.extractor_revisions).toEqual(["xv1", "xv2"]);
  expect(canTransition("framing_extract", "confirmed", "draft")).toBe(false);
  expect(canTransition("framing_extract", "draft", "generating")).toBe(false);
});
