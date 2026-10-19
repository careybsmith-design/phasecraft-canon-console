import { afterEach, describe, expect, it, vi } from "vitest";
import { liveBuildPlatform } from "./live";
const request = {
  platform: "lovable" as const,
  prompt_id: "prompt",
  run_id: "thread-run",
  compiled_prompt: "typed prompt",
  compiled_hash: "hash",
  repro_key: { model_version: "m", template_version: "t", guardrail_set_version: "g" },
  cost_ceiling: 3,
};
afterEach(() => vi.unstubAllGlobals());
describe("Live build correlation", () => {
  it("sends the immutable THREAD run ID for callback correlation", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ id: "external-run" }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(
      await liveBuildPlatform("lovable", { url: "https://builder.test", token: "test" }).dispatch(
        request,
      ),
    ).toEqual({ external_run_id: "external-run" });
    expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      run_id: "thread-run",
      prompt_id: "prompt",
      compiled_hash: "hash",
      cost_ceiling: 3,
    });
  });
  it("rejects a missing platform ID rather than persisting the string undefined", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({})),
    );
    await expect(
      liveBuildPlatform("lovable", { url: "https://builder.test", token: "test" }).dispatch(
        request,
      ),
    ).rejects.toThrow("PLATFORM_RESULT_INVALID");
  });
});
