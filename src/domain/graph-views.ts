/**
 * Operating Graph Explorer views (Part 11.3) and the framing views added to
 * Phase 2 by Part 8A.15 (Need Web, Dependency Web, Decomposition Tree,
 * Contradiction Map). Shared by the server functions and the /graph surface.
 */
import { REGISTRY } from "./registry";

export const EXPLORER_VIEWS = [
  "navigator", "mission", "nebula", "focus", "path", "impact",
  "need_web", "dependency_web", "decomposition", "contradictions", "integrity",
] as const;
export type ExplorerView = (typeof EXPLORER_VIEWS)[number];

export const VIEW_LABELS: Record<ExplorerView, string> = {
  navigator: "Canon Navigator",
  mission: "Mission Constellation",
  nebula: "Nebula",
  focus: "Focus",
  path: "Path Finder",
  impact: "Impact / Blast Radius",
  need_web: "Need Web",
  dependency_web: "Dependency Web",
  decomposition: "Decomposition Tree",
  contradictions: "Contradiction Map",
  integrity: "Graph integrity",
};

export const OVERLAYS = ["family", "authority", "expiration", "detector"] as const;
export type Overlay = (typeof OVERLAYS)[number];

const evidenceTypes = REGISTRY.filter((r) => r.family === "Evidence").map((r) => r.type);
export const CANON_TYPES = REGISTRY.filter((r) => r.family === "Canon").map((r) => r.type);

/** Type/verb filters for the subgraph views. Layer = row in the Decomposition Tree. */
export const SUBGRAPH_VIEWS = {
  navigator: { types: CANON_TYPES, verbs: ["cites", "derives_from", "relates_to", "contradicts", "blocks", "reveals", "governed_by"] },
  need_web: { types: ["NeedStatement"], verbs: ["depends_on", "relates_to", "contradicts"] },
  dependency_web: { types: ["BehaviorStatement"], verbs: ["depends_on"] },
  decomposition: {
    types: ["NeedStatement", "BehaviorStatement", "ComposableCapability", ...evidenceTypes],
    verbs: ["expressed_as", "addresses", "needs_capability", "verified_by", "evidenced_by"],
  },
} as const;
export type SubgraphView = keyof typeof SUBGRAPH_VIEWS;

export function decompositionLayer(type: string): number {
  if (type === "NeedStatement") return 0;
  if (type === "BehaviorStatement") return 1;
  if (type === "ComposableCapability") return 2;
  return 3;
}
