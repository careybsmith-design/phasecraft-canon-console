import { describe, expect, it } from "vitest";
import {
  applyPostRules,
  segment,
  ruleClassify,
  isMaterial,
  entryTestComplete,
  mergeEntryTest,
  EMPTY_ENTRY_TEST,
  statedDependency,
  polarityConflict,
  precisionRecall,
  p95,
  type Participant,
} from "./framing";
import { classifyContent, luhnValid } from "./content-tier";
import { LIFECYCLE_FAMILIES, canTransition } from "./lifecycle";

const coCreator: Participant = {
  id: "a",
  name: "Dana",
  role: "co_creator",
  decision_authority: true,
  authority_domain: "Claims Operations Lead",
};
const builder: Participant = { id: "b", name: "Sam", role: "builder", decision_authority: false };

describe("8A.5 authority-aware classification", () => {
  it("an offhand rule from a non-authority speaker becomes a suggestion and the mismatch is surfaced", () => {
    const r = applyPostRules(
      {
        classification: "decision",
        object_type: "ConfirmedDecision",
        kind: null,
        materiality_uncertain: false,
        confidence: 0.9,
        title: "x",
      },
      builder,
      [coCreator, builder],
    );
    expect(r.classification).toBe("suggestion");
    expect(r.authority_mismatch).toBe(
      "Recorded as a suggestion — the decision authority for this belongs to Dana (Claims Operations Lead).",
    );
    expect(r.material).toBe(false);
  });
  it("the same decision from the authority holder stays a material decision", () => {
    const r = applyPostRules(
      {
        classification: "decision",
        object_type: "ConfirmedDecision",
        kind: null,
        materiality_uncertain: false,
        confidence: 0.9,
        title: "x",
      },
      coCreator,
      [coCreator, builder],
    );
    expect(r.classification).toBe("decision");
    expect(r.material).toBe(true);
    expect(r.authority_mismatch).toBeNull();
  });
  it("context never becomes an object", () => {
    const r = applyPostRules(
      {
        classification: "context",
        object_type: "BehaviorStatement",
        kind: "rule",
        materiality_uncertain: false,
        confidence: 0.5,
        title: "x",
      },
      coCreator,
      [coCreator],
    );
    expect(r.object_type).toBeNull();
  });
  it("an uncertain rule asks in the session instead of guessing", () => {
    const r = applyPostRules(
      {
        classification: "suggestion",
        object_type: "BehaviorStatement",
        kind: "rule",
        materiality_uncertain: true,
        confidence: 0.5,
        title: "x",
      },
      coCreator,
      [coCreator],
    );
    expect(r.materiality_question).toMatch(/should I record it as one\?/);
  });
  it("material items are exactly rules, exceptions, consequences, decisions and confirmed behaviour", () => {
    expect(isMaterial("decision", "ConfirmedDecision", null)).toBe(true);
    expect(isMaterial("confirmed_behavior", "BehaviorStatement", "behavior")).toBe(true);
    expect(isMaterial("suggestion", "BehaviorStatement", "rule")).toBe(false);
    expect(isMaterial("question", "OpenQuestion", null)).toBe(false);
  });
});

describe("8A.3 segmentation and rules", () => {
  it("splits into statement units with character spans", () => {
    const u = segment("We need members to see coverage. Should it include family totals?");
    expect(u).toHaveLength(2);
    expect(u[1]!.text).toBe("Should it include family totals?");
    expect(
      "We need members to see coverage. Should it include family totals?".slice(
        u[1]!.start,
        u[1]!.end,
      ),
    ).toBe(u[1]!.text);
  });
  it("in-boundary rules classify a question", () =>
    expect(ruleClassify("Who owns the directory?").classification).toBe("question"));
  it("detects a stated dependency", () =>
    expect(statedDependency("Coverage view depends on the eligibility feed")?.kind).toBe("data"));
  it("flags opposite polarity on the same subject", () => {
    expect(
      polarityConflict(
        "Claims over ten thousand dollars go to a human adjuster",
        "Claims over ten thousand dollars do not go to a human adjuster",
      ),
    ).toBe(true);
  });
});

describe("8A.1 entry test", () => {
  it("is complete only with all four parts", () => {
    const e = mergeEntryTest(EMPTY_ENTRY_TEST, {
      person: "members",
      outcome: "calls",
      ability: "self-serve",
    });
    expect(entryTestComplete(e)).toBe(false);
    expect(entryTestComplete(mergeEntryTest(e, { evidence: "call volume" }))).toBe(true);
  });
});

describe("8A.3 tier gate", () => {
  it("Luhn-valid card numbers are Tier C", () => {
    expect(luhnValid("4111111111111111")).toBe(true);
    expect(classifyContent("card 4111 1111 1111 1111").tier).toBe("C");
  });
  it("an SSN is Tier C", () => expect(classifyContent("SSN 123-45-6789").tier).toBe("C"));
  it("health content without identifiers is Tier B", () =>
    expect(classifyContent("the diagnosis drives the claim").tier).toBe("B"));
  it("plain business talk is Tier A", () =>
    expect(classifyContent("members want to see coverage").tier).toBe("A"));
});

describe("lifecycles", () => {
  it("framing sessions open capture, then close; never back", () => {
    expect(canTransition("framing_session", "planned", "capturing")).toBe(true);
    expect(canTransition("framing_session", "closed", "capturing")).toBe(false);
  });
  it("an extracted object can be rejected from draft but a confirmation is never undone", () => {
    expect(canTransition("framing_extract", "draft", "rejected")).toBe(true);
    expect(canTransition("framing_extract", "confirmed", "draft")).toBe(false);
    expect(LIFECYCLE_FAMILIES.framing_session.flat()).not.toContain("approved");
  });
});

describe("8A.13 measurement", () => {
  it("precision and recall per label", () => {
    const pr = precisionRecall(
      [
        { expected: "a", predicted: "a" },
        { expected: "a", predicted: "b" },
        { expected: "b", predicted: "a" },
      ],
      ["a", "b"],
    );
    expect(pr[0]).toMatchObject({ tp: 1, fp: 1, fn: 1, precision: 0.5, recall: 0.5 });
  });
  it("p95 nearest rank", () => expect(p95([1, 2, 3, 4, 5, 6, 7, 8, 9, 100])).toBe(100));
});
