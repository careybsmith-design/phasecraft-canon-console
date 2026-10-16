import { describe, expect, it } from "vitest";
import { LIFECYCLE_FAMILIES, canTransition, type LifecycleFamily } from "./lifecycle";
describe("Every declared lifecycle transition rule", () => {
  for (const [name, ranks] of Object.entries(LIFECYCLE_FAMILIES)) {
    for (let fromRank = 0; fromRank < ranks.length; fromRank++) {
      for (let toRank = 0; toRank < ranks.length; toRank++) {
        for (const from of ranks[fromRank] ?? []) for (const to of ranks[toRank] ?? []) {
          it(`${name}: ${from} → ${to} ${toRank > fromRank ? "allowed" : "refused"}`, () => {
            expect(canTransition(name as LifecycleFamily, from, to)).toBe(toRank > fromRank);
          });
        }
      }
    }
  }
});