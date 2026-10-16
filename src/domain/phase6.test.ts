import { describe, it, expect } from "vitest";
import { compileCreationPrompt, containsRawText, costRefusal, detectChangeClass, scopeSmuggled, platformRefusal, PLATFORMS, reproKeyString, QUOTE_MAX } from "./creation";

const RAW = "um so basically Dana said we should just text everyone whenever anything moves, honestly";
const behavior = { id: "b1", human_ref: "BS-1", condition: "a claim status changes", observable_result: "the member sees the new status", operating_constraints: ["never show another member's history"],
  // raw captured text placed on the source object; the compiler must not read it
  raw_text: RAW, provenance_spans: [{ quote: RAW }] } as never;
const base = {
  behaviors: [behavior],
  contract: { id: "c1", human_ref: "EO-1", desired_outcome: "members know where their claim is", transcript: RAW } as never,
  template: { id: "t1", human_ref: "TP-1", version: "3", stack: "TanStack", instructions: "Build the smallest slice." },
  guardrails: [{ id: "g1", category: "phi_block", version: "2", enforcement: "enforcing" as const }],
  capabilities: [], platform: "codex" as const,
};

describe("Phase 6 creation loop", () => {
  it("P13.4: raw captured text on source objects is absent from the compiled prompt", () => {
    const { text } = compileCreationPrompt(base);
    expect(text).not.toContain(RAW);
    expect(text.toLowerCase()).not.toContain("dana said");
    expect(containsRawText(text, [RAW])).toBeNull();
    expect(text).toContain("BS-1");
  });
  it("guardrails applied are enumerated on the prompt", () => {
    expect(compileCreationPrompt(base).guardrails_applied).toEqual([{ id: "g1", version: "2", enforcement: "enforcing" }]);
  });
  it("raw text injected into a typed field is caught by the guard", () => {
    const { text } = compileCreationPrompt({ ...base, behaviors: [{ id: "b", human_ref: "BS-2", condition: RAW, observable_result: "x" }] });
    expect(containsRawText(text, [RAW])).toBe(RAW);
  });
  it("a bounded quoted reference is capped and sits outside the instruction region", () => {
    const { text } = compileCreationPrompt({ ...base, quoted_reference: RAW + "x".repeat(500) });
    expect(containsRawText(text, [RAW])).toBeNull();
    expect(text.length).toBeLessThan(compileCreationPrompt(base).text.length + QUOTE_MAX + 200);
  });
  it("Lovable never receives confidential or restricted content", () => {
    expect(platformRefusal("lovable", "confidential")).toMatch(/PLATFORM_NOT_CLEARED/);
    expect(platformRefusal("lovable", "restricted")).toMatch(/PLATFORM_NOT_CLEARED/);
    expect(platformRefusal("lovable", "internal")).toBeNull();
    for (const p of PLATFORMS) expect(platformRefusal(p, "restricted")).toMatch(/PLATFORM_NOT_CLEARED/);
  });
  it("cost ceilings are enforced at dispatch", () => {
    expect(costRefusal(5, 0, [])).toMatch(/COST_CEILING_REQUIRED/);
    expect(costRefusal(12, 10, [])).toMatch(/COST_CEILING_EXCEEDED/);
    expect(costRefusal(5, 10, [{ scope: "mission", ceiling: 25, committed: 20 }])).toMatch(/BUDGET_EXCEEDED/);
    expect(costRefusal(5, 10, [{ scope: "cell", ceiling: 25, committed: 10 }])).toBeNull();
  });
  it("a scope change classified as cosmetic is caught", () => {
    const d = { added_obligations: ["also send SMS reminders"], changed_results: [], changed_contracts: [], text_edits: ["label"] };
    expect(detectChangeClass(d)).toBe("scope");
    expect(scopeSmuggled("cosmetic", d)).toBe(true);
    expect(scopeSmuggled("behavioural", d)).toBe(true);
    expect(scopeSmuggled("scope", d)).toBe(false);
    expect(scopeSmuggled("cosmetic", { ...d, added_obligations: [] })).toBe(false);
  });
  it("the reproducibility key pins all six parts", () => {
    const k = { prompt_version: 1, prompt_hash: "h", platform: "cursor" as const, model_route: "r", model_version: "m", guardrail_set_version: "g", template_version: "t" };
    expect(reproKeyString(k)).toBe(reproKeyString({ ...k }));
    expect(reproKeyString(k)).not.toBe(reproKeyString({ ...k, model_version: "m2" }));
  });
});
