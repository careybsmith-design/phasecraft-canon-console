import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ObjectLookupInput, GraphSearchInput, ENVELOPE_COLUMNS } from "@/domain/object-read";
import { lookupObjectCore, searchGraphCore } from "./object-read.server";

const id = "11111111-1111-4111-8111-111111111111";
function fixture(results: Record<string, { data: unknown; error: { message: string } | null }>) {
  const chains: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};
  const from = vi.fn((table: string) => {
    const methods = Object.fromEntries(
      ["select", "eq", "in", "textSearch", "limit", "maybeSingle"].map((name) => [name, vi.fn()]),
    );
    const chain = {
      ...methods,
      then: (resolve: (r: unknown) => unknown) =>
        Promise.resolve(results[table] ?? { data: [], error: null }).then(resolve),
    };
    for (const method of Object.values(methods)) method.mockReturnValue(chain);
    chains[table] = methods;
    return chain;
  });
  return { sb: { from } as unknown as SupabaseClient<Database>, from, chains };
}
describe("Shared human and agent Section 19 object reads", () => {
  it("validates exactly one identity and positive versions", () => {
    expect(ObjectLookupInput.safeParse({}).success).toBe(false);
    expect(ObjectLookupInput.safeParse({ id, human_ref: "VS-2026-0001" }).success).toBe(false);
    expect(ObjectLookupInput.safeParse({ id, version: 0 }).success).toBe(false);
    expect(ObjectLookupInput.safeParse({ human_ref: "VS-2026-0001", version: 2 }).success).toBe(
      true,
    );
  });
  it("resolves a human reference and returns provenance and expiration", async () => {
    const record = {
      id,
      human_ref: "VS-2026-0001",
      provenance_chain_id: id,
      expiration_condition: { kind: "review_date_passes" },
      body: { observed_condition: "Wait" },
    };
    const f = fixture({ objects: { data: record, error: null } });
    expect(await lookupObjectCore(f.sb, { human_ref: "VS-2026-0001" })).toEqual(record);
    expect(f.chains["objects"]?.["eq"]).toHaveBeenCalledWith("human_ref", "VS-2026-0001");
    expect(f.chains["objects"]?.["select"]).toHaveBeenCalledWith(ENVELOPE_COLUMNS);
  });
  it("never queries old permissions when the current parent is hidden", async () => {
    const f = fixture({ objects: { data: null, error: null } });
    await expect(lookupObjectCore(f.sb, { id, version: 2 })).rejects.toThrow("NOT_FOUND");
    expect(f.from).not.toHaveBeenCalledWith("object_versions");
  });
  it.each([null, { message: "history unavailable" }])(
    "refuses missing or failed requested versions %s",
    async (error) => {
      const f = fixture({
        objects: { data: { id }, error: null },
        object_versions: { data: null, error },
      });
      await expect(lookupObjectCore(f.sb, { id, version: 2 })).rejects.toThrow(
        error ? "history unavailable" : "NOT_FOUND",
      );
    },
  );
  it("returns version two only after reading the current parent", async () => {
    const f = fixture({
      objects: { data: { id, version: 3 }, error: null },
      object_versions: { data: { id, version: 2 }, error: null },
    });
    expect(await lookupObjectCore(f.sb, { id, version: 2 })).toMatchObject({ version: 2 });
    expect(f.from.mock.calls.map(([table]) => table)).toEqual(["objects", "object_versions"]);
  });
  it("search preserves type/state/limit and complete envelope selection", async () => {
    const f = fixture({});
    expect(
      await searchGraphCore(
        f.sb,
        GraphSearchInput.parse({
          q: "claims",
          types: ["ValueSignal"],
          states: ["recorded"],
          limit: 7,
        }),
      ),
    ).toEqual([]);
    expect(f.chains["objects"]?.["in"]).toHaveBeenCalledWith("type", ["ValueSignal"]);
    expect(f.chains["objects"]?.["in"]).toHaveBeenCalledWith("lifecycle_state", ["recorded"]);
    expect(f.chains["objects"]?.["limit"]).toHaveBeenCalledWith(7);
    expect(f.chains["objects"]?.["select"]).toHaveBeenCalledWith(ENVELOPE_COLUMNS);
  });
  it("failed search never becomes empty success", async () => {
    const f = fixture({ objects: { data: null, error: { message: "search unavailable" } } });
    await expect(searchGraphCore(f.sb, GraphSearchInput.parse({ q: "claims" }))).rejects.toThrow(
      "search unavailable",
    );
  });
});
