import { describe, expect, it, vi } from "vitest";
import { getRegistry, getObjectDetail } from "./canon.functions";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
const id = "11111111-1111-4111-8111-111111111111";
function fixture(failed?: string, hidden = false) {
  const from = vi.fn((table: string) => {
    const result = {
      data: table === "objects" ? (hidden ? null : { id }) : [],
      error: table === failed ? { message: `${table} unavailable` } : null,
    };
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      maybeSingle: vi.fn(),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    for (const method of [chain.select, chain.eq, chain.order, chain.maybeSingle])
      method.mockReturnValue(chain);
    return chain;
  });
  return { from, args: { data: { id }, context: { supabase: { from } } } };
}
type Handler = (args: ReturnType<typeof fixture>["args"]) => Promise<unknown>;
describe("Human read operations fail closed on partial retrieval", () => {
  it.each(["object_type_registry", "lifecycle_transitions", "lifecycle_initial_states"])(
    "registry refuses failed %s retrieval",
    async (table) => {
      const f = fixture(table);
      await expect((getRegistry as unknown as Handler)(f.args)).rejects.toThrow(
        `${table} unavailable`,
      );
    },
  );
  it.each(["objects", "object_versions", "ledger"])(
    "detail refuses failed %s retrieval",
    async (table) => {
      const f = fixture(table);
      await expect((getObjectDetail as unknown as Handler)(f.args)).rejects.toThrow(
        `${table} unavailable`,
      );
    },
  );
  it("hidden current parents never query historical data", async () => {
    const f = fixture(undefined, true);
    await expect((getObjectDetail as unknown as Handler)(f.args)).rejects.toThrow("NOT_FOUND");
    expect(f.from).not.toHaveBeenCalledWith("object_versions");
    expect(f.from).not.toHaveBeenCalledWith("ledger");
  });
  it("a truly empty visible history is successful, unlike a failed read", async () => {
    const f = fixture();
    expect(await (getObjectDetail as unknown as Handler)(f.args)).toEqual({
      object: { id },
      versions: [],
      ledger: [],
    });
  });
});
