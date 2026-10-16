import { describe, expect, it } from "vitest";
import { validateGenericBody } from "./generic-body";
describe("Generic canonical body boundary", () => {
  it("rejects empty concept definitions", () => expect(() => validateGenericBody("Concept", {})).toThrow());
  it("rejects mistyped observed conditions", () => expect(() => validateGenericBody("ValueSignal", { observed_condition: 2 })).toThrow());
  it("accepts typed behavior conditions and observable results", () => expect(validateGenericBody("BehaviorStatement", { condition: "status changes", observable_result: "member sees current status" })).toHaveProperty("observable_result", "member sees current status"));
  it("fails closed for privileged types without a generic contract", () => expect(() => validateGenericBody("AuthorityGrant", { authority_level: "autonomous_with_exception" })).toThrow("DEDICATED_OPERATION_REQUIRED"));
});