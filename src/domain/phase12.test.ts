import { describe, expect, it } from "vitest";
import {
  MCP_BODY_BYTES,
  MCP_BATCH_ITEMS,
  SCALE_TARGET,
  boundedJson,
  rpcBatch,
  recoveryWithinTarget,
  independentlyVerified,
  AssuranceInput,
} from "./hardening";

describe("Phase 12 hardening", () => {
  it("accepts exactly 20 RPC messages, refuses 21 and empty batches", () => {
    expect(rpcBatch(Array(20).fill({ method: "ping" }))).toHaveLength(MCP_BATCH_ITEMS);
    expect(() => rpcBatch(Array(21).fill({}))).toThrow("BATCH_LIMIT");
    expect(() => rpcBatch([])).toThrow("BATCH_LIMIT");
  });
  it("reads valid bounded JSON", async () =>
    expect(
      await boundedJson(new Request("https://thread.test", { method: "POST", body: '{"id":1}' })),
    ).toEqual({ id: 1 }));
  it("rejects oversized JSON even without Content-Length", async () => {
    const body = '"' + "a".repeat(MCP_BODY_BYTES) + '"';
    await expect(
      boundedJson(new Request("https://thread.test", { method: "POST", body })),
    ).rejects.toThrow("BODY_LIMIT");
  });
  it("accepts the exact byte ceiling", async () => {
    const body = '"' + "a".repeat(MCP_BODY_BYTES - 2) + '"';
    expect(
      ((await boundedJson(new Request("https://thread.test", { method: "POST", body }))) as string)
        .length,
    ).toBe(MCP_BODY_BYTES - 2);
  });
  it("rejects advertised oversized bodies", async () => {
    await expect(
      boundedJson(
        new Request("https://thread.test", {
          method: "POST",
          headers: { "content-length": String(MCP_BODY_BYTES + 1) },
          body: "{}",
        }),
      ),
    ).rejects.toThrow("BODY_LIMIT");
  });
  it("rejects malformed JSON", async () =>
    await expect(
      boundedJson(new Request("https://thread.test", { method: "POST", body: "{" })),
    ).rejects.toThrow());
  it("requires recovery within 15 minute RPO, 4 hour RTO and a verified ledger", () => {
    expect(recoveryWithinTarget(15, 240, true)).toBe(true);
    expect(recoveryWithinTarget(16, 240, true)).toBe(false);
    expect(recoveryWithinTarget(15, 241, true)).toBe(false);
    expect(recoveryWithinTarget(1, 1, false)).toBe(false);
    expect(recoveryWithinTarget(-1, 1, true)).toBe(false);
  });
  it("uses 10 times the upper year-one estimates, not 100 times", () => {
    expect(SCALE_TARGET).toEqual({
      operating_objects: 5000000,
      relationships: 30000000,
      evidence_objects: 15000000,
      live_renditions: 1000000,
      humans: 2000,
      agent_calls_per_second: 5000,
    });
  });
  const independent = {
    code_route: "builder",
    test_route: "verifier",
    implementation_visible: false,
    human_reviewed: true,
    provenance: "independently_authored",
  };
  it("refuses circular verification by the same route", () =>
    expect(independentlyVerified({ ...independent, test_route: "builder" })).toBe(false));
  it("refuses implementation-visible verification", () =>
    expect(independentlyVerified({ ...independent, implementation_visible: true })).toBe(false));
  it("requires human review of independent test intent", () =>
    expect(independentlyVerified({ ...independent, human_reviewed: false })).toBe(false));
  it("accepts independently authored blind reviewed verification", () =>
    expect(independentlyVerified(independent)).toBe(true));
  it("requires cited assurance evidence", () =>
    expect(
      AssuranceInput.safeParse({
        subject_id: "00000000-0000-4000-8000-000000000001",
        kind: "penetration",
        result: "passed",
        evidence_refs: [],
        rationale: "scan",
      }).success,
    ).toBe(false));
});
