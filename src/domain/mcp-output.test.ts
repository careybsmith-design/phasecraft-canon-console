import { describe, expect, it } from "vitest";
import { validateToolOutput } from "./mcp-output";
import { TOOLS, toolContract } from "./mcp-tools";
describe("Executable MCP output contracts", () => {
  it("publishes a real JSON Schema for every tool, not description-only metadata", () => {
    for (const tool of TOOLS) expect(toolContract(tool).output_schema).toHaveProperty("$schema");
  });
  it("array operations reject object-root results", () => {
    expect(validateToolOutput("search_graph", [])).toEqual([]);
    expect(() => validateToolOutput("search_graph", {})).toThrow("OUTPUT_VALIDATION_FAILED");
  });
  it("authority evaluation requires a policy evidence result", () => {
    expect(() => validateToolOutput("evaluate_authority", { id: "x", history: [] })).toThrow("OUTPUT_VALIDATION_FAILED");
    expect(validateToolOutput("evaluate_authority", { outcome: {}, risk: {}, policy_evaluation: { id: "p" }, decision_request: null })).toHaveProperty("policy_evaluation.id", "p");
  });
  it.each([undefined, NaN, Infinity, { id: undefined }, { id: new Date() }])("rejects silently unserializable output %s", (value) => {
    expect(() => validateToolOutput("detect_value_signal", value)).toThrow("OUTPUT_VALIDATION_FAILED");
  });
});