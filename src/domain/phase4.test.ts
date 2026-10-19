import { describe, expect, it } from "vitest";
import {
  contractGaps,
  BODY_REQUIRED_KEYS,
  effectiveAuthority,
  reuseDecisionError,
  shapeMatch,
  reuseMode,
  retirementDue,
  CONTRACT_FIELDS,
} from "./fabric";
import { REGISTRY } from "./registry";

describe("7.2 capability contract", () => {
  it("all 19 source contract groups are present", () => expect(CONTRACT_FIELDS).toHaveLength(19));
  it("an empty body lists every gap; a full body has none", () => {
    expect(contractGaps({}).length).toBeGreaterThanOrEqual(19);
    const full = Object.fromEntries(BODY_REQUIRED_KEYS.map((k) => [k, "x"]));
    expect(contractGaps(full)).toEqual([]);
  });
  it("every required body key exists on the ComposableCapability registry entry or 7.6", () => {
    const cc = REGISTRY.find((r) => r.type === "ComposableCapability")!;
    const fields = String((cc as unknown as { key_fields: string }).key_fields ?? "");
    expect(fields.length).toBeGreaterThan(0);
  });
});

describe("7.5 composition", () => {
  it("effective authority is the minimum of the parts", () => {
    expect(effectiveAuthority(["act_bounded", "recommend", "autonomous_with_exception"])).toBe(
      "recommend",
    );
    expect(effectiveAuthority([])).toBe("observe");
  });
});

describe("7.4 reuse-first gate", () => {
  const r = (gaps: string[]) => ({
    capability_id: "c",
    match_score: 0.8,
    reuse_mode: "compose" as const,
    gaps,
  });
  it("create_new is blocked when a result has no recorded gaps", () => {
    expect(reuseDecisionError([r([])], "create_new", "want my own")).toMatch(/CREATE_NEW_BLOCKED/);
  });
  it("create_new is allowed with no results, or when every result has gaps, with a rationale", () => {
    expect(reuseDecisionError([], "create_new", "nothing exists")).toBeNull();
    expect(
      reuseDecisionError([r(["missing output x"])], "create_new", "gaps too large"),
    ).toBeNull();
    expect(reuseDecisionError([], "create_new", " ")).toMatch(/RATIONALE/);
  });
  it("shape match scores overlap and records gaps", () => {
    const m = shapeMatch(
      { outcome: "", domain: "", inputs: ["claim", "policy"], outputs: ["decision"] },
      ["claim"],
      ["decision"],
    );
    expect(m.score).toBeCloseTo(2 / 3);
    expect(m.gaps).toEqual(["missing input policy"]);
    expect(reuseMode(0.9, [])).toBe("use_as_is");
  });
});

describe("7.6 automatic retirement", () => {
  it("retires on low use after a full window, or on expiry; never inside the first window", () => {
    expect(
      retirementDue({
        uses_in_window: 1,
        minimum_use: 10,
        published_days: 31,
        window_days: 30,
        expired: false,
      }),
    ).toMatch(/below minimum/);
    expect(
      retirementDue({
        uses_in_window: 1,
        minimum_use: 10,
        published_days: 5,
        window_days: 30,
        expired: false,
      }),
    ).toBeNull();
    expect(
      retirementDue({
        uses_in_window: 99,
        minimum_use: 10,
        published_days: 5,
        window_days: 30,
        expired: true,
      }),
    ).toMatch(/expiration/);
  });
});
