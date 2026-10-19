import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const migration = readFileSync(
  "drizzle/migrations/0070_reaudit_agent_reservation_serialization.sql",
  "utf8",
);
it("single-use confirmations and quota reservations acquire transaction locks", () => {
  expect(migration).toContain("where token_hash = p_token_hash FOR UPDATE;");
  expect(migration).toContain("where id = p_confirmation FOR UPDATE;");
  expect(migration).toContain("c.expires_at <= now()");
});
it("reservation calls cannot use negative cost to bypass the cap", () => {
  expect(migration).toContain("p_cost IS NULL OR p_cost < 0");
  expect(migration).toContain("INVALID_CALL_COST");
});
it("reservation writes stay inaccessible to public and authenticated roles", () => {
  expect(migration).toContain("FROM PUBLIC,anon,authenticated");
  expect(migration).toContain("TO service_role");
});
