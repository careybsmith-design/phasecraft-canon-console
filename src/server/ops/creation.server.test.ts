import { describe, expect, it, vi } from "vitest";
import { compilePromptCore, dispatchCore } from "./creation.server";
import type { OpCtx } from "./context";

const id = "11111111-1111-4111-8111-111111111111";
function fixture(results: Record<string, { data: unknown; error: { message: string } | null }>) {
  const rpc = vi.fn();
  const from = vi.fn((table: string) => {
    const result = results[table] ?? { data: null, error: null };
    const chain = { select: vi.fn(), in: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), single: vi.fn(), then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve) };
    for (const method of [chain.select, chain.in, chain.eq, chain.maybeSingle, chain.single]) method.mockReturnValue(chain);
    return chain;
  });
  const ctx = { sb: { from }, db: { from, rpc }, actor: { kind: "human", id, authority_used: "observe" }, userId: id } as unknown as OpCtx;
  return { ctx, rpc };
}
const input = { behavior_ids: [id], contract_id: id, template_id: id, reuse_check_id: id, target_platform: "lovable" as const, estimated_cost: 0 };
describe("Creation context fails closed before any write or dispatch", () => {
  it.each(["objects", "guardrails", "reuse_checks"])("refuses failed %s reads", async (table) => {
    const { ctx, rpc } = fixture({ [table]: { data: null, error: { message: "permission denied" } } });
    await expect(compilePromptCore(ctx, input)).rejects.toThrow("permission denied");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("refuses an absent or hidden reuse check", async () => {
    const { ctx, rpc } = fixture({});
    await expect(compilePromptCore(ctx, input)).rejects.toThrow("REUSE_CHECK_REQUIRED");
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each(["creation_prompts", "adapter_bindings"])("does not silently use simulated dispatch after a failed %s read", async (table) => {
    const { ctx, rpc } = fixture({ objects: { data: { id, data_classification: "internal" }, error: null }, [table]: { data: null, error: { message: "permission denied" } } });
    await expect(dispatchCore(ctx, { prompt_id: id, platform: "lovable", cost_ceiling: 1, estimated_cost: 0 })).rejects.toThrow("permission denied");
    expect(rpc).not.toHaveBeenCalled();
  });
});