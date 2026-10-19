import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "drizzle/migrations/0064_audit4_phase10_fail_closed_acceptance.sql",
  "utf8",
);

describe("audit round 4: Phase 10 acceptance is fail-closed", () => {
  it("NULL assertions fail in all three acceptance suites", () => {
    const occurrences = sql.match(/IS DISTINCT FROM 'true'/g) ?? [];
    expect(occurrences.length).toBe(3);
    expect(sql).not.toMatch(/r->>'pass'<>'true'/);
  });

  it("recorded evidence aggregates all three suite verdicts", () => {
    expect(sql).toContain(
      "(ev->>'passed')::boolean AND (graph_ev->>'passed')::boolean AND (risk_ev->>'passed')::boolean",
    );
  });

  it("the native signal-detector check matches the fixture it created", () => {
    expect(sql).toContain("object_id=sig2.id");
  });

  it("acceptance functions stay service-role only", () => {
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.thread_phase10_selftest()");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.thread_phase10_selftest()");
  });
});
