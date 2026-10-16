import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool, handleRpc, syncContracts } from "./gateway.server";

const fake = vi.hoisted(() => ({ rpc: vi.fn(), handler: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: fake.rpc } }));
vi.mock("./agent-session.server", () => ({ agentReadClient: vi.fn(async () => ({})) }));
vi.mock("./tools.server", () => ({ HANDLERS: { detect_value_signal: fake.handler, score_value_signal: fake.handler } }));
const id = "11111111-1111-4111-8111-111111111111";
const begin = { refused: false, call_id: id, agent: { id, name: "test", auth_user_id: id, owner_id: id, authority_ceiling: "recommend" } };
beforeEach(() => {
  fake.rpc.mockReset(); fake.handler.mockReset();
  fake.handler.mockResolvedValue({ id, human_ref: "VS-2026-0001" });
  fake.rpc.mockImplementation(async (name: string) => name === "thread_agent_begin_call" ? { data: begin, error: null } : { data: 123, error: null });
});
describe("MCP receipt enforcement", () => {
  it("failed contract sync is retryable and is never cached as success", async () => {
    fake.rpc.mockResolvedValueOnce({ data: null, error: { message: "denied" } }).mockResolvedValueOnce({ data: 0, error: null });
    await expect(syncContracts()).rejects.toThrow("CONTRACT_SYNC_FAILED");
    await expect(syncContracts()).resolves.toBeUndefined();
    expect(fake.rpc).toHaveBeenCalledTimes(2);
  });
  it("successful mutation with failed completion never reports success or completes twice", async () => {
    fake.rpc.mockImplementation(async (name: string) => name === "thread_agent_begin_call" ? { data: begin, error: null } : { data: null, error: { message: "lost receipt" } });
    const promise = callTool("test-hash", "detect_value_signal", { observed_condition: "Members wait nine days", evidence_refs: [id] });
    await expect(promise).rejects.toMatchObject({ details: { code: "CALL_COMPLETION_FAILED", operation_outcome: "succeeded", side_effects_may_have_happened: true, retry_safe: false } });
    expect(fake.handler).toHaveBeenCalledTimes(1);
    expect(fake.rpc.mock.calls.filter(([name]) => name === "thread_agent_end_call")).toHaveLength(1);
  });
  it("validation failure never executes a handler and still requires a receipt", async () => {
    fake.rpc.mockImplementation(async (name: string) => name === "thread_agent_begin_call" ? { data: begin, error: null } : { data: null, error: { message: "lost receipt" } });
    await expect(callTool("test-hash", "score_value_signal", { signal_id: "invalid" })).rejects.toMatchObject({ details: { operation_outcome: "not_started", side_effects_may_have_happened: false } });
    expect(fake.handler).not.toHaveBeenCalled();
  });
  it("JSON-RPC completion errors include reconciliation details", async () => {
    fake.rpc.mockImplementation(async (name: string) => name === "thread_agent_begin_call" ? { data: begin, error: null } : { data: null, error: { message: "lost receipt" } });
    const result = await handleRpc("test-hash", { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "score_value_signal", arguments: { signal_id: id } } });
    expect(result).toMatchObject({ error: { data: { code: "CALL_COMPLETION_FAILED", call_id: id, retry_safe: false } } });
  });
});