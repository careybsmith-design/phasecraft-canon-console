import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0074_signal_intake_si1_selftest.sql", "utf8");

it("SI-1 SQL self-test attempts a ledger-valid mission insert against a detected signal and asserts its trigger exception", () => {
  expect(sql).toContain("signal.lifecycle_state is distinct from 'detected'");
  expect(sql).toContain("perform public.thread_create_object(actor,");
  expect(sql).toContain("public._fx_payload('ValueMission'");
  expect(sql).toContain("jsonb_build_object('signal_ref',signal.id)");
  expect(sql).toContain("ok := state = 'P0001' and err like 'MISSION_SIGNAL_NOT_PROMOTED:%'");
  expect(sql).toContain("err := 'ValueMission insert unexpectedly succeeded'");
  expect(sql).toContain("(x->>'ok')::boolean is distinct from true");
});

it("SI-1 runs fail-closed at deployment, rolls back fixtures, and stays service-role-only", () => {
  expect(sql).toContain("r := public.thread_signal_intake_selftest()");
  expect(sql).toContain("r->>'all_ok' is distinct from 'true'");
  expect(sql).toContain("raise exception 'SI1_SELFTEST_FAILED: %', r");
  expect(sql).toContain("raise exception using errcode = 'TT001', message = 'SELFTEST_ROLLBACK'");
  expect(sql).toContain("exception when sqlstate 'TT001' then null");
  expect(sql).toContain("from public, anon, authenticated");
  expect(sql).toContain("to service_role");
});
