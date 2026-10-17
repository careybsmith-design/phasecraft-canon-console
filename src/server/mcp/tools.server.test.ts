import { describe, expect, it, vi } from "vitest";
import { HANDLERS, type AgentCtx } from "./tools.server";

const id = "11111111-1111-4111-8111-111111111111";
function fixture(results: Record<string, { data: unknown; error: { message: string } | null }>) {
  const rpc = vi.fn(async () => ({ data: { id }, error: null }));
  const chains: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};
  const from = vi.fn((table: string) => {
    const result = results[table] ?? { data: [], error: null };
    const methods = Object.fromEntries(["select", "eq", "in", "contains", "textSearch", "limit", "order", "maybeSingle"].map((method) => [method, vi.fn()]));
    const chain = { ...methods, then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve) };
    for (const method of Object.values(methods)) method.mockReturnValue(chain);
    chains[table] = methods;
    return chain;
  });
  const ctx = { sb: { from }, db: { rpc }, actor: { kind: "agent", id, authority_used: "observe" }, userId: id, agentId: id, ownerId: id } as unknown as AgentCtx;
  return { ctx, rpc, from, chains };
}
async function run(name: string, ctx: AgentCtx, args: Record<string, unknown>) {
  const handler = HANDLERS[name];
  if (!handler) throw new Error("Missing test handler");
  return handler(ctx, args);
}
describe("Section 19 read and evidence contracts", () => {
  it("looks up historical versions only after a current visible parent", async () => {
    const f = fixture({ objects: { data: { id }, error: null }, object_versions: { data: { id, version: 2 }, error: null } });
    await expect(run("get_object", f.ctx, { id, version: 2 })).resolves.toEqual({ id, version: 2 });
    expect(f.chains["object_versions"]?.["eq"]).toHaveBeenCalledWith("version", 2);
  });
  it("never reads history when the current parent is hidden", async () => {
    const f = fixture({ objects: { data: null, error: null } });
    await expect(run("get_object", f.ctx, { id, version: 2 })).rejects.toThrow("NOT_FOUND");
    expect(f.from).not.toHaveBeenCalledWith("object_versions");
  });
  it("applies the specified search state filter", async () => {
    const f = fixture({});
    await run("search_graph", f.ctx, { q: "claims", states: ["published"] });
    expect(f.chains["objects"]?.["in"]).toHaveBeenCalledWith("lifecycle_state", ["published"]);
  });
  it("preserves withdrawal evidence in the authority write", async () => {
    const f = fixture({ objects: { data: { id }, error: null } });
    await run("withdraw_authority", f.ctx, { object_id: id, reason: "Changed evidence", evidence_refs: [id] });
    expect(f.rpc).toHaveBeenCalledWith("thread_set_authority", expect.objectContaining({ p_evidence: [id] }));
  });
  it("refuses a withdrawal with unreadable evidence before writing", async () => {
    const f = fixture({ objects: { data: { id }, error: null } });
    const hidden = fixture({ objects: { data: null, error: null } });
    const currentRead = f.from.getMockImplementation();
    const hiddenRead = hidden.from.getMockImplementation();
    if (!currentRead || !hiddenRead) throw new Error("Missing fixture implementation");
    f.from.mockImplementationOnce((table: string) => currentRead(table));
    f.from.mockImplementationOnce((table: string) => hiddenRead(table));
    await expect(run("withdraw_authority", f.ctx, { object_id: id, reason: "Changed evidence", evidence_refs: [id] })).rejects.toThrow("NOT_FOUND");
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it.each(["find_related_missions", "get_canon_history", "evaluate_policy", "surface_prior_objects"])("%s never reports failed reads as an empty success", async (name) => {
    const f = fixture({ objects: { data: { id }, error: { message: "permission denied" } } });
    await expect(run(name, f.ctx, { id, object_id: id, condition: "claims", statement: "claims" })).rejects.toThrow("permission denied");
  });
  it("object lookup reports a failed read rather than an empty success", async () => {
    const f = fixture({ objects: { data: null, error: { message: "permission denied" } } });
    await expect(run("get_object", f.ctx, { id })).rejects.toThrow("permission denied");
  });
  it("outcome evidence retrieval refuses failed reads", async () => {
    const f = fixture({ objects: { data: { id, human_ref: "CC-2026-0001" }, error: null } });
    // A successful parent lookup followed by a failed evidence query.
    const broken = fixture({ objects: { data: null, error: { message: "evidence unavailable" } } });
    const original = broken.ctx.sb.from.bind(broken.ctx.sb);
    let calls = 0;
    broken.ctx.sb.from = ((table: string) => ++calls === 1 ? f.ctx.sb.from(table as "objects") : original(table as "objects")) as typeof broken.ctx.sb.from;
    await expect(run("monitor_outcome_evidence", broken.ctx, { capability_id: id })).rejects.toThrow("evidence unavailable");
  });
});