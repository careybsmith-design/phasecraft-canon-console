import { describe, expect, it } from "vitest";
import { assessRisk, evaluateAuthority, CONFIDENCE_DIMENSIONS, type Consequence, type Reversibility, type Novelty, type Tier, type BundleInput } from "@/server/authority/engine";
const consequences: Consequence[] = ["none", "reversible", "costly_reversible", "irreversible", "rights_affecting", "safety", "lifeline"];
const reversibilities: Reversibility[] = ["trivial", "assisted", "difficult", "impossible"];
const novelties: Novelty[] = ["established_pattern", "adapted_pattern", "novel"];
const cases = ([1,2,3,4] as Tier[]).flatMap((tier) => [0.2,0.6,0.9].flatMap((confidence) => consequences.flatMap((consequence) => reversibilities.flatMap((reversibility) => novelties.map((novelty) => ({ tier, confidence, consequence, reversibility, novelty }))))));
describe("Part 21 full risk × confidence × consequence × reversibility × novelty matrix", () => {
  it.each(cases)("$tier / $confidence / $consequence / $reversibility / $novelty", ({ tier, confidence, consequence, reversibility, novelty }) => {
    const risk = assessRisk({ consequence, reversibility, novelty, sensitivity: "internal", autonomy: 0.2, exposure: "internal_only", evidence: 1 }, "2026-10-16T12:00:00Z");
    const actualTier = Math.max(tier,risk.computed_tier) as Tier;
    const bundle = Object.fromEntries(CONFIDENCE_DIMENSIONS.map((key) => [key, { value: confidence, evidence_refs: ["evidence"] }])) as BundleInput;
    bundle.owner_confidence = { value: confidence };
    const out = evaluateAuthority({ action: "release", now: "2026-10-16T12:00:00Z", object: { type: "ComposableCapability", owner_id: "owner", risk_tier: actualTier, consequence_class: consequence, data_classification: "internal" }, actor: { kind: "agent", id: "agent", authority: "act_bounded" }, grant: { level: "act_bounded", effective_to: "2027-01-01T00:00:00Z" } }, bundle, []);
    const independent = actualTier === 4 || ["rights_affecting","safety","lifeline"].includes(consequence);
    if (independent) expect(out.treatment).toBe("explicit_human_decision_independent");
    else if (consequence === "irreversible" || confidence < 0.5) expect(out.decision).toBe("escalate_human_decision");
    else if (confidence < 0.8) expect(out.treatment).toBe("limited_exposure_with_observation");
    else if (actualTier <= 2 && ["none","reversible"].includes(consequence)) expect(out.treatment).toBe("automatic_release");
    else expect(out.decision).toBe("proceed_with_confirmation");
  });
});