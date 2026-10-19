import { afterEach, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
import { liveModelGateway } from "./live";
const request = {
  route: "test",
  purpose: "classification",
  data_classification: "internal" as const,
  messages: [{ role: "user" as const, content: "Business rules" }],
};
afterEach(() => {
  vi.restoreAllMocks();
  rpc.mockReset();
});
it("L-15 refuses missing eligibility before fetching", async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  const fetcher = vi.spyOn(globalThis, "fetch");
  await expect(liveModelGateway("test").complete(request)).rejects.toThrow(
    "MODEL_ROUTE_NOT_CLEARED",
  );
  expect(fetcher).not.toHaveBeenCalled();
});
it("L-20 scans Tier C before eligibility or network", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch");
  await expect(
    liveModelGateway("test").complete({
      ...request,
      messages: [{ role: "user", content: "4111 1111 1111 1111" }],
    }),
  ).rejects.toThrow("TIER_ROUTE_REFUSED");
  expect(rpc).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});
