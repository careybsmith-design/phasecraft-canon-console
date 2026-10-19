import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it.each([
    [
      "/evidence/11111111-1111-4111-8111-111111111111",
      "/_authenticated/evidence_/$capabilityId",
      "capabilityId",
      "11111111-1111-4111-8111-111111111111",
    ],
    [
      "/sessions/22222222-2222-4222-8222-222222222222",
      "/_authenticated/sessions/$sessionId",
      "sessionId",
      "22222222-2222-4222-8222-222222222222",
    ],
    [
      "/framing/22222222-2222-4222-8222-222222222222",
      "/_authenticated/framing/$sessionId",
      "sessionId",
      "22222222-2222-4222-8222-222222222222",
    ],
  ])("matches required deep link %s without an intervening page", (url, leaf, key, id) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes(url);
    expect(matches.map((m) => m.routeId)).toEqual([rootRouteId, "/_authenticated", leaf]);
    expect(matches.at(-1)?.params).toHaveProperty(key, id);
  });
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
  it("opens the complete audit as an authenticated route", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes("/build-audit").at(-1)?.routeId).toBe("/_authenticated/build-audit");
  });
});
