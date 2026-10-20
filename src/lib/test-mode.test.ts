import { describe, expect, it } from "vitest";
import { isTestEligible } from "./test-mode";

describe("isTestEligible (test-mode steward grant guard)", () => {
  it("accepts only a verified anonymous session", () => {
    expect(isTestEligible({ is_anonymous: true })).toBe(true);
  });

  it("refuses real accounts", () => {
    expect(isTestEligible({ is_anonymous: false })).toBe(false);
    expect(isTestEligible({})).toBe(false);
    expect(isTestEligible(null)).toBe(false);
    expect(isTestEligible(undefined)).toBe(false);
  });

  it("refuses a truthy non-boolean flag (type mismatch)", () => {
    expect(isTestEligible({ is_anonymous: "true" })).toBe(false);
    expect(isTestEligible({ is_anonymous: 1 })).toBe(false);
  });
});
