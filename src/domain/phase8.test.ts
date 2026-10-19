import { describe, expect, it } from "vitest";
import {
  CANON_MARKER,
  RENDITION_KINDS,
  citationRefusal,
  generationRoute,
  isStale,
  prohibitedInference,
  serveRefusal,
} from "./generation";

describe("Phase 8 generation layer", () => {
  it("supports every Part 10.3 kind including the morning brief", () => {
    expect(Object.keys(RENDITION_KINDS)).toHaveLength(17);
    expect(RENDITION_KINDS.morning_intelligence_brief).toBeDefined();
    expect(CANON_MARKER).toBe("Generated from canon. Not canon.");
  });
  it("refuses requests for individual activity metrics (14.3)", () => {
    for (const t of [
      "Show prompt count per builder",
      "Leaderboard of builders",
      "Rank individual employees by output",
      "Hours connected for each person",
      "Activity by person this week",
      "summarise private conversations",
      "a status report for the board",
    ])
      expect(prohibitedInference(t)).not.toBeNull();
    expect(prohibitedInference("Explain the claim status capability to a new adjuster")).toBeNull();
  });
  it("refuses guidance without citations or with citations outside the sources", () => {
    expect(citationRefusal(["a"], [])).toMatch(/CITATIONS_REQUIRED/);
    expect(citationRefusal(["a"], ["b"])).toMatch(/CITATION_NOT_A_SOURCE/);
    expect(citationRefusal(["a", "b"], ["a"])).toBeNull();
  });
  it("is stale when any source hash changes or the source is tombstoned", () => {
    const stamp = [{ id: "a", version: 1, content_hash: "h1" }];
    expect(isStale(stamp, { a: { content_hash: "h1" } })).toBe(false);
    expect(isStale(stamp, { a: { content_hash: "h2" } })).toBe(true);
    expect(isStale(stamp, { a: { content_hash: "h1", is_tombstone: true } })).toBe(true);
  });
  it("is never served outside its identity and purpose", () => {
    const ctx = { actor: "u1", purpose: "onboard" };
    expect(serveRefusal(ctx, "u1", "onboard", "live")).toBeNull();
    expect(serveRefusal(ctx, "u2", "onboard", "live")).toMatch(/CONTEXT_MISMATCH/);
    expect(serveRefusal(ctx, "u1", "board pack", "live")).toMatch(/CONTEXT_MISMATCH/);
    expect(serveRefusal(ctx, "u1", "onboard", "stale")).toMatch(/STALE/);
  });
  it("keeps confidential and restricted sources in-boundary", () => {
    expect(generationRoute("internal")).toBe("live");
    expect(generationRoute("confidential")).toBe("in_boundary");
    expect(generationRoute("restricted")).toBe("in_boundary");
  });
});
