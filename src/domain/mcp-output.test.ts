import { describe, expect, it } from "vitest";
import { validateToolOutput } from "./mcp-output";
import { TOOLS, toolContract } from "./mcp-tools";
import { ENVELOPE_COLUMNS } from "./object-read";
describe("Executable MCP output contracts", () => {
  it("publishes a real JSON Schema for every tool, not description-only metadata", () => {
    for (const tool of TOOLS) expect(toolContract(tool).output_schema).toHaveProperty("$schema");
  });
  it("array operations reject object-root results", () => {
    expect(validateToolOutput("search_graph", [])).toEqual([]);
    expect(() => validateToolOutput("search_graph", {})).toThrow("OUTPUT_VALIDATION_FAILED");
  });
  it("authority evaluation requires a policy evidence result", () => {
    expect(() => validateToolOutput("evaluate_authority", { id: "x", history: [] })).toThrow(
      "OUTPUT_VALIDATION_FAILED",
    );
    expect(
      validateToolOutput("evaluate_authority", {
        outcome: {},
        risk: {},
        policy_evaluation: { id: "p" },
        decision_request: null,
      }),
    ).toHaveProperty("policy_evaluation.id", "p");
  });
  it("object reads cannot report a partial identity as a full envelope", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(() => validateToolOutput("get_object", { id })).toThrow("OUTPUT_VALIDATION_FAILED");
    expect(() =>
      validateToolOutput("search_graph", [{ id, human_ref: "VS-2026-0001", type: "ValueSignal" }]),
    ).toThrow("OUTPUT_VALIDATION_FAILED");
    const full = {
      ...Object.fromEntries(ENVELOPE_COLUMNS.split(",").map((key) => [key, null])),
      id,
      human_ref: "VS-2026-0001",
      type: "ValueSignal",
      schema_version: "1.0.0",
      version: 1,
      lifecycle_state: "recorded",
      body: {},
      permission: {},
      expiration_condition: {},
      retirement_path: {},
      evidence_refs: [],
      provenance_chain_id: id,
      content_hash: "abc",
      supersedes: [],
      superseded_by: [],
      derived_from: [],
      permitted_uses: [],
      open_questions: [],
      is_tombstone: false,
    };
    expect(validateToolOutput("get_object", full)).toHaveProperty("provenance_chain_id", id);
    const { expiration_condition: omitted, ...missingExpiration } = full;
    expect(() => validateToolOutput("get_object", missingExpiration)).toThrow(
      "OUTPUT_VALIDATION_FAILED",
    );
  });
  it.each([undefined, NaN, Infinity, { id: undefined }, { id: new Date() }])(
    "rejects silently unserializable output %s",
    (value) => {
      expect(() => validateToolOutput("detect_value_signal", value)).toThrow(
        "OUTPUT_VALIDATION_FAILED",
      );
    },
  );
});
