import { expect, it } from "vitest";
import { verificationIndependence, type VerificationRecord } from "./verification-independence";
const row: VerificationRecord = {
  id: "test",
  compliance_scoped: true,
  code_route: "builder",
  test_route: "verifier",
  implementation_visible: false,
  human_reviewed: true,
  provenance: "independently_authored",
  confirmed_behavior_ref: "behavior",
  outcome_contract_ref: "contract",
  mutation_sample_passed: true,
  cycle_reviewed: true,
};
it("L-09 enforces 70% overall and 100% compliance", () => {
  const records = Array.from({ length: 10 }, (_, i) => ({
    ...row,
    id: String(i),
    compliance_scoped: i === 0,
    human_reviewed: i < 7,
  }));
  expect(verificationIndependence(records)).toMatchObject({
    overall_pct: 70,
    compliance_pct: 100,
    pass: true,
  });
  records[0] = { ...row, human_reviewed: false };
  expect(verificationIndependence(records).pass).toBe(false);
});
it("L-09 missing evidence is not a metric pass", () =>
  expect(verificationIndependence([])).toMatchObject({
    overall_pct: null,
    compliance_pct: null,
    pass: false,
  }));
it.each([
  "confirmed_behavior_ref",
  "outcome_contract_ref",
  "mutation_sample_passed",
  "cycle_reviewed",
] as const)("L-09 requires %s", (key) => {
  const changed = { ...row, [key]: key.endsWith("ref") ? null : false };
  expect(verificationIndependence([changed]).pass).toBe(false);
});
