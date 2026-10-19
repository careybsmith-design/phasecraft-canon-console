/**
 * Pure graph helpers shared by the Explorer views and tests.
 * Heavy queries (traversal, paths, closure, cycles, orphans, layout) run in SQL;
 * these helpers only place small subgraphs and enforce honest edge budgets.
 */

export interface GNode {
  id: string;
  type: string;
  label: string;
  x?: number;
  y?: number;
  cluster?: string;
  tombstone?: boolean;
}
export interface GEdge {
  id: string;
  verb: string;
  from: string;
  to: string;
  source: string;
  confidence?: number | null;
}

/** Part 16.5 rule 4: cap rendered edges and state the cap. */
export function applyEdgeBudget<T>(
  edges: T[],
  budget: number,
): { shown: T[]; total: number; label: string } {
  const shown = edges.slice(0, Math.max(0, budget));
  const label =
    shown.length < edges.length
      ? `showing ${shown.length.toLocaleString("en-US")} of ${edges.length.toLocaleString("en-US")} edges`
      : `showing all ${edges.length.toLocaleString("en-US")} edges`;
  return { shown, total: edges.length, label };
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/**
 * Deterministic cluster placement. Same formula as the SQL function
 * thread_refresh_graph_layout, so precomputed and synthetic layouts agree.
 * Cluster k of n sits on a ring; member i sits on a golden-angle spiral.
 */
export function clusterCentre(k: number, n: number, radius = 1000): { x: number; y: number } {
  const a = (2 * Math.PI * k) / Math.max(1, n);
  return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
}
export function spiralOffset(i: number, spacing = 6): { x: number; y: number } {
  const r = spacing * Math.sqrt(i + 1);
  return { x: r * Math.cos(i * GOLDEN), y: r * Math.sin(i * GOLDEN) };
}

/** Radial placement by hop distance for Focus / Impact (small subgraphs only). */
export function radialByDepth(
  nodes: Array<{ id: string; depth: number }>,
  ring = 120,
): Map<string, { x: number; y: number }> {
  const byDepth = new Map<number, string[]>();
  for (const n of nodes) byDepth.set(n.depth, [...(byDepth.get(n.depth) ?? []), n.id]);
  const out = new Map<string, { x: number; y: number }>();
  for (const [d, ids] of byDepth) {
    ids.forEach((id, i) => {
      const a = (2 * Math.PI * i) / ids.length + d * 0.4;
      out.set(id, {
        x: d === 0 ? 0 : d * ring * Math.cos(a),
        y: d === 0 ? 0 : d * ring * Math.sin(a),
      });
    });
  }
  return out;
}

/** Layered placement for the Decomposition Tree: one row per layer. */
export function layered(
  nodes: Array<{ id: string; layer: number }>,
  gapX = 80,
  gapY = 140,
): Map<string, { x: number; y: number }> {
  const rows = new Map<number, string[]>();
  for (const n of nodes) rows.set(n.layer, [...(rows.get(n.layer) ?? []), n.id]);
  const out = new Map<string, { x: number; y: number }>();
  for (const [layer, ids] of rows)
    ids.forEach((id, i) => out.set(id, { x: (i - (ids.length - 1) / 2) * gapX, y: layer * gapY }));
  return out;
}

/** Finds directed cycles (used by tests; the live check is SQL graph_cycles). */
export function findCycles(edges: Array<{ from: string; to: string }>): string[][] {
  const adj = new Map<string, string[]>();
  for (const e of edges) adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
  const cycles: string[][] = [];
  const seen = new Set<string>();
  const dfs = (start: string, node: string, path: string[]) => {
    for (const next of adj.get(node) ?? []) {
      if (next === start) {
        const key = [...path].sort().join(",");
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push([...path, start]);
        }
      } else if (!path.includes(next) && next > start) dfs(start, next, [...path, next]);
    }
  };
  for (const n of adj.keys()) dfs(n, n, [n]);
  return cycles;
}

/** Synthetic Nebula fixture for the 20,000-node render benchmark (labelled synthetic in the UI). */
export function syntheticNebula(nodeCount: number, clusterCount: number, edgeCount: number) {
  const nodes: GNode[] = [];
  const per = Math.ceil(nodeCount / clusterCount);
  for (let i = 0; i < nodeCount; i++) {
    const k = Math.floor(i / per);
    const c = clusterCentre(k, clusterCount, 2200);
    const o = spiralOffset(i % per, 5);
    nodes.push({
      id: `s${i}`,
      type: `cluster-${k}`,
      label: `S-${i}`,
      x: c.x + o.x,
      y: c.y + o.y,
      cluster: `cluster-${k}`,
    });
  }
  const edges: GEdge[] = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let j = 0; j < edgeCount; j++) {
    const a = Math.floor(rnd() * nodeCount);
    const sameCluster = Math.floor(a / per) * per + Math.floor(rnd() * per);
    const b = Math.min(nodeCount - 1, sameCluster);
    if (a !== b)
      edges.push({
        id: `e${j}`,
        verb: "relates_to",
        from: `s${a}`,
        to: `s${b}`,
        source: "inferred",
      });
  }
  return { nodes, edges };
}
