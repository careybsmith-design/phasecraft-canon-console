import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  getNeighbourhood, getPaths, getClosure, getSubgraph, getContradictions, getNebula, getIntegrity, getVerbs,
  createEdge, retireEdge, runGraphSweep, recordRenderBenchmark, getPhase2Evidence, runPhase2Evidence,
  type GraphNode, type GraphEdge,
} from "@/lib/graph.functions";
import { listObjects } from "@/lib/canon.functions";
import { EXPLORER_VIEWS, VIEW_LABELS, OVERLAYS, type Overlay, decompositionLayer } from "@/domain/graph-views";
import { applyEdgeBudget, radialByDepth, layered, spiralOffset, clusterCentre, syntheticNebula } from "@/domain/graph";
import { edgeAllowed, ORIGINS, DEPENDENCY_KINDS } from "@/domain/relationships";
import { GraphCanvas, type CanvasNode, type CanvasEdge, type CanvasStatus, type GraphCanvasHandle } from "@/components/graph/GraphCanvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Search = z.object({
  view: z.enum(EXPLORER_VIEWS).default("navigator"),
  root: z.string().uuid().optional(),
  from: z.string().uuid().optional(),
  to: z.string().uuid().optional(),
  depth: z.number().int().min(1).max(6).optional(),
  overlay: z.enum(OVERLAYS).default("family"),
  cluster: z.string().max(80).optional(),
});

export const Route = createFileRoute("/_authenticated/graph")({
  validateSearch: Search,
  head: () => ({
    meta: [
      { title: "Operating Graph Explorer · THREAD" },
      { name: "description", content: "Navigate THREAD's operating graph: canon, nebula, focus, paths, blast radius, needs, dependencies and contradictions." },
      { property: "og:title", content: "Operating Graph Explorer · THREAD" },
      { property: "og:description", content: "Navigate the connected operating model, see how objects are connected and what a change affects." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Explorer,
});

function errText(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  try { const j = JSON.parse(m); return `${j.code}: ${j.explanation}`; } catch { return m; }
}

const FAMILY_TOKENS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "tier-1", "tier-2", "tier-3", "tier-4", "primary", "ok", "warn", "ring", "accent-foreground"];
function nodeToken(n: GraphNode, overlay: Overlay, families: string[]): string {
  if (overlay === "authority") return `tier-${n.risk_tier}`;
  if (overlay === "detector") return n.open_findings > 0 ? "destructive" : "muted-foreground";
  if (overlay === "expiration") {
    const days = (new Date(n.review_date).getTime() - Date.now()) / 864e5;
    return days < 0 ? "destructive" : days < 30 ? "warn" : "ok";
  }
  const i = Math.max(0, families.indexOf(n.family));
  return FAMILY_TOKENS[i % FAMILY_TOKENS.length]!;
}

function toCanvas(nodes: GraphNode[], edges: GraphEdge[], overlay: Overlay, pos: (n: GraphNode, i: number) => { x: number; y: number }, highlight?: Set<string>) {
  const families = [...new Set(nodes.map((n) => n.family))].sort();
  const cn: CanvasNode[] = nodes.map((n, i) => ({ id: n.id, label: `${n.ref} ${n.title}`, ...pos(n, i), size: n.depth === 0 ? 8 : 5, token: nodeToken(n, overlay, families), tombstone: n.tombstone }));
  const ce: CanvasEdge[] = edges.map((e) => ({ id: e.id, source: e.from, target: e.to, inferred: e.source === "inferred", highlight: !!highlight?.has(e.id), label: e.verb }));
  return { cn, ce };
}

function download(name: string, data: unknown) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = `${name}.json`; a.click();
}

function Explorer() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/graph" });
  const set = (patch: Partial<z.infer<typeof Search>>) => navigate({ search: (p) => ({ ...p, ...patch }) });
  return (
    <main className="space-y-3 p-4">
      <nav aria-label="Explorer views" className="flex flex-wrap items-center gap-1">
        {EXPLORER_VIEWS.map((v) => (
          <button key={v} type="button" onClick={() => set({ view: v })} aria-current={s.view === v ? "page" : undefined}
            className={`rounded-md border px-2 py-1 text-xs ${s.view === v ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"}`}>{VIEW_LABELS[v]}</button>
        ))}
        <label className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">Overlay
          <select value={s.overlay} onChange={(e) => set({ overlay: e.target.value as Overlay })} className="h-7 rounded-md border bg-background px-1">
            <option value="family">Family</option><option value="authority">Authority / risk tier</option>
            <option value="expiration">Expiration</option><option value="detector">Detector findings</option>
          </select>
        </label>
      </nav>
      {s.view === "navigator" && <SubgraphView view="navigator" overlay={s.overlay} onFocus={(id) => set({ view: "focus", root: id })} />}
      {s.view === "need_web" && <SubgraphView view="need_web" overlay={s.overlay} onFocus={(id) => set({ view: "focus", root: id })} />}
      {s.view === "dependency_web" && <SubgraphView view="dependency_web" overlay={s.overlay} onFocus={(id) => set({ view: "focus", root: id })} />}
      {s.view === "decomposition" && <SubgraphView view="decomposition" overlay={s.overlay} onFocus={(id) => set({ view: "focus", root: id })} />}
      {s.view === "nebula" && <Nebula cluster={s.cluster} overlay={s.overlay} setCluster={(c) => set({ cluster: c })} onFocus={(id) => set({ view: "focus", root: id })} />}
      {s.view === "focus" && <Focus root={s.root} depth={Math.min(s.depth ?? 2, 3)} overlay={s.overlay} set={set} />}
      {s.view === "path" && <PathFinder from={s.from} to={s.to} depth={s.depth ?? 4} overlay={s.overlay} set={set} />}
      {s.view === "impact" && <Impact root={s.root} depth={s.depth ?? 6} overlay={s.overlay} set={set} />}
      {s.view === "contradictions" && <Contradictions overlay={s.overlay} onFocus={(id) => set({ view: "focus", root: id })} />}
      {s.view === "integrity" && <Integrity onFocus={(id) => set({ view: "focus", root: id })} />}
    </main>
  );
}

function Toolbar({ label, canvas, name, data }: { label: string; canvas: React.RefObject<GraphCanvasHandle | null>; name: string; data: unknown }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span role="status" className="ident text-muted-foreground">{label}</span>
      <span className="text-muted-foreground">· canon graph, not generated</span>
      <Button size="sm" variant="outline" className="ml-auto h-7" onClick={() => canvas.current?.exportPng(name)}>Export image</Button>
      <Button size="sm" variant="outline" className="h-7" onClick={() => download(name, data)}>Export data</Button>
    </div>
  );
}

function EdgePanel({ edge, nodes, onClose }: { edge: GraphEdge; nodes: GraphNode[]; onClose: () => void }) {
  const retire = useServerFn(retireEdge);
  const qc = useQueryClient();
  const [why, setWhy] = useState("");
  const ref = (id: string) => nodes.find((n) => n.id === id)?.ref ?? id.slice(0, 8);
  return (
    <aside aria-label="Why is this connected?" className="space-y-2 rounded-md border bg-card p-3 text-xs">
      <div className="flex items-center"><h3 className="text-sm font-semibold">Why is this connected?</h3>
        <button type="button" className="ml-auto underline" onClick={onClose}>Close</button></div>
      <p className="ident">{ref(edge.from)} <span className="text-primary">{edge.verb}</span> {ref(edge.to)}</p>
      <dl className="grid grid-cols-2 gap-1">
        {[["Origin", edge.source + (edge.source === "inferred" ? " (inferred)" : "")], ["Kind", edge.kind ?? "—"], ["Confidence", edge.confidence ?? "—"],
          ["Authority used", edge.authority_used], ["Actor", `${edge.created_by?.kind}:${String(edge.created_by?.id).slice(0, 8)}`],
          ["Recorded", new Date(edge.created_at).toLocaleString()], ["Evidence", edge.evidence_refs.length ? edge.evidence_refs.map((e) => e.slice(0, 8)).join(", ") : "none cited"]]
          .map(([k, v]) => <div key={String(k)}><dt className="label-caps">{k}</dt><dd className="ident">{String(v)}</dd></div>)}
      </dl>
      <p><span className="label-caps">Rationale</span> {edge.rationale ?? "—"}</p>
      <div className="flex gap-2">
        <Input className="h-7" placeholder="Reason to retire this edge" value={why} onChange={(e) => setWhy(e.target.value)} aria-label="Reason to retire" />
        <Button size="sm" variant="destructive" className="h-7" disabled={!why} onClick={async () => {
          try { await retire({ data: { id: edge.id, reason: why } }); toast.success("Edge retired"); qc.invalidateQueries(); onClose(); } catch (e) { toast.error(errText(e)); }
        }}>Retire</Button>
      </div>
    </aside>
  );
}

function ObjectPicker({ label, value, onPick }: { label: string; value?: string | undefined; onPick: (id: string, type: string) => void }) {
  const list = useServerFn(listObjects);
  const [q, setQ] = useState("");
  const r = useQuery({ queryKey: ["pick", q], queryFn: () => list({ data: { q: q || undefined } }), enabled: q.length > 1 });
  const id = `pick-${label.replace(/\W/g, "")}`;
  return (
    <div className="relative space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder={value ? `selected ${value.slice(0, 8)}… search to change` : "Search by title or statement"} className="h-8" />
      {q.length > 1 && (r.data?.length ?? 0) > 0 && (
        <ul className="absolute z-10 max-h-56 w-full overflow-auto rounded-md border bg-popover text-xs">
          {r.data!.slice(0, 20).map((o) => (
            <li key={o.id}><button type="button" className="w-full px-2 py-1 text-left hover:bg-accent" onClick={() => { onPick(o.id, o.type); setQ(""); }}>
              <span className="ident">{o.human_ref}</span> {o.title} <span className="text-muted-foreground">· {o.type}</span></button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GraphWithPanel({ nodes, edges, overlay, pos, highlight, label, name, onNode, ariaLabel }: {
  nodes: GraphNode[]; edges: GraphEdge[]; overlay: Overlay; pos: (n: GraphNode, i: number) => { x: number; y: number };
  highlight?: Set<string>; label: string; name: string; onNode: (id: string) => void; ariaLabel: string;
}) {
  const canvas = useRef<GraphCanvasHandle>(null);
  const [edgeId, setEdgeId] = useState<string | null>(null);
  const { cn, ce } = useMemo(() => toCanvas(nodes, edges, overlay, pos, highlight), [nodes, edges, overlay, pos, highlight]);
  const edge = edges.find((e) => e.id === edgeId);
  return (
    <div className="space-y-2">
      <Toolbar label={label} canvas={canvas} name={name} data={{ nodes, edges }} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <GraphCanvas ref={canvas} nodes={cn} edges={ce} onNode={onNode} onEdge={setEdgeId} ariaLabel={ariaLabel} />
        <div className="space-y-2">
          {edge ? <EdgePanel edge={edge} nodes={nodes} onClose={() => setEdgeId(null)} /> : <p className="text-xs text-muted-foreground">Click a node to focus it. Click an edge to see why it exists. Faint edges are inferred.</p>}
          <ul className="max-h-[440px] divide-y overflow-auto rounded-md border bg-panel text-xs">
            {nodes.slice(0, 300).map((n) => (
              <li key={n.id}><button type="button" onClick={() => onNode(n.id)} className={`w-full px-2 py-1 text-left hover:bg-accent ${n.tombstone ? "text-tombstone line-through" : ""}`}>
                <span className="ident">{n.ref}</span> {n.title} <span className="text-muted-foreground">· {n.type} · {n.state}</span>
                {n.open_findings > 0 && <span className="text-destructive"> · {n.open_findings} finding(s)</span>}</button></li>
            ))}
            {nodes.length === 0 && <li className="p-2 text-muted-foreground">Nothing here yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

const spiralPos = (_n: GraphNode, i: number) => { const o = spiralOffset(i, 40); return { x: o.x, y: o.y }; };

function SubgraphView({ view, overlay, onFocus }: { view: "navigator" | "need_web" | "dependency_web" | "decomposition"; overlay: Overlay; onFocus: (id: string) => void }) {
  const get = useServerFn(getSubgraph);
  const q = useQuery({ queryKey: ["subgraph", view], queryFn: () => get({ data: { view } }) });
  const pos = useMemo(() => {
    if (view !== "decomposition" && view !== "navigator") return spiralPos;
    const nodes = q.data?.nodes ?? [];
    const types = [...new Set(nodes.map((n) => n.type))].sort();
    const m = layered(nodes.map((n) => ({ id: n.id, layer: view === "decomposition" ? decompositionLayer(n.type) : types.indexOf(n.type) })), 90, 120);
    return (n: GraphNode) => m.get(n.id) ?? { x: 0, y: 0 };
  }, [q.data, view]);
  if (q.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (q.error) return <p className="text-destructive">{errText(q.error)}</p>;
  const d = q.data!;
  const budget = applyEdgeBudget(d.edges, d.edge_budget);
  const label = `${d.nodes.length.toLocaleString("en-US")} of ${(d.total_nodes ?? d.nodes.length).toLocaleString("en-US")} objects · showing ${d.edges.length.toLocaleString("en-US")} of ${d.total_edges.toLocaleString("en-US")} edges`;
  return <GraphWithPanel nodes={d.nodes} edges={budget.shown} overlay={overlay} pos={pos} label={label} name={`thread-${view}`} onNode={onFocus} ariaLabel={`${VIEW_LABELS[view]} graph`} />;
}

function Focus({ root, depth, overlay, set }: { root?: string | undefined; depth: number; overlay: Overlay; set: (p: Record<string, unknown>) => void }) {
  const get = useServerFn(getNeighbourhood);
  const q = useQuery({ queryKey: ["focus", root, depth], queryFn: () => get({ data: { root: root!, depth } }), enabled: !!root });
  const pos = useMemo(() => {
    const m = radialByDepth((q.data?.nodes ?? []).map((n) => ({ id: n.id, depth: n.depth ?? 1 })));
    return (n: GraphNode) => m.get(n.id) ?? { x: 0, y: 0 };
  }, [q.data]);
  const rootNode = q.data?.nodes.find((n) => n.id === root);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <ObjectPicker label="Focus object" value={root} onPick={(id) => set({ root: id })} />
        <label className="space-y-1 text-xs"><span className="block">Hops</span>
          <select value={depth} onChange={(e) => set({ depth: Number(e.target.value) })} className="h-8 rounded-md border bg-background px-2">{[1, 2, 3].map((d) => <option key={d}>{d}</option>)}</select></label>
        {root && <div className="flex items-end gap-2">
          <Button size="sm" variant="outline" onClick={() => set({ view: "impact" })}>Blast radius</Button>
          <Link to="/canon" search={{ id: root }} className="text-xs underline">Open in canon console</Link></div>}
      </div>
      {!root && <p className="text-muted-foreground">Pick an object to see it and its neighbours, with the provenance of every edge.</p>}
      {q.error && <p className="text-destructive">{errText(q.error)}</p>}
      {rootNode && <LinkForm from={rootNode} />}
      {q.data && <GraphWithPanel nodes={q.data.nodes} edges={q.data.edges} overlay={overlay} pos={pos}
        label={`${q.data.nodes.length} objects within ${depth} hop(s) · showing ${q.data.edges.length} of ${q.data.total_edges} edges`}
        name="thread-focus" onNode={(id) => set({ root: id })} ariaLabel="Focus graph" />}
    </div>
  );
}

function LinkForm({ from }: { from: GraphNode }) {
  const verbsFn = useServerFn(getVerbs);
  const create = useServerFn(createEdge);
  const qc = useQueryClient();
  const verbs = useQuery({ queryKey: ["verbs"], queryFn: () => verbsFn() });
  const [to, setTo] = useState<{ id: string; type: string } | null>(null);
  const [f, setF] = useState({ verb: "", source: "stated", kind: "", rationale: "" });
  const allowed = (verbs.data ?? []).filter((v) => !v.computed && (!to || edgeAllowed(v.verb, from.type, to.type)));
  return (
    <form className="grid gap-2 rounded-md border bg-card p-3 sm:grid-cols-[1.3fr_1fr_0.8fr_0.8fr_1.4fr_auto] sm:items-end" onSubmit={async (e) => {
      e.preventDefault();
      if (!to) return;
      try {
        await create({ data: { verb: f.verb, from_id: from.id, to_id: to.id, source: f.source, kind: f.kind || undefined, rationale: f.rationale } });
        toast.success("Edge recorded"); setF({ ...f, rationale: "" }); qc.invalidateQueries();
      } catch (err) { toast.error(errText(err)); }
    }}>
      <ObjectPicker label={`Link ${from.ref} to`} value={to?.id} onPick={(id, type) => setTo({ id, type })} />
      <label className="space-y-1 text-xs"><span className="block">Verb</span>
        <select required value={f.verb} onChange={(e) => setF({ ...f, verb: e.target.value })} className="h-8 w-full rounded-md border bg-background px-1">
          <option value="">{to ? `${allowed.length} allowed` : "pick target first"}</option>{allowed.map((v) => <option key={v.verb}>{v.verb}</option>)}</select></label>
      <label className="space-y-1 text-xs"><span className="block">Origin</span>
        <select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} className="h-8 w-full rounded-md border bg-background px-1">{ORIGINS.map((o) => <option key={o}>{o}</option>)}</select></label>
      <label className="space-y-1 text-xs"><span className="block">Kind</span>
        <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className="h-8 w-full rounded-md border bg-background px-1" disabled={f.verb !== "depends_on"}>
          <option value="">—</option>{DEPENDENCY_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
      <div className="space-y-1"><Label htmlFor="edge-why">Why this connection exists</Label><Input id="edge-why" required className="h-8" value={f.rationale} onChange={(e) => setF({ ...f, rationale: e.target.value })} /></div>
      <Button type="submit" size="sm" disabled={!to || !f.verb || !f.rationale}>Link</Button>
    </form>
  );
}

function PathFinder({ from, to, depth, overlay, set }: { from?: string | undefined; to?: string | undefined; depth: number; overlay: Overlay; set: (p: Record<string, unknown>) => void }) {
  const get = useServerFn(getPaths);
  const q = useQuery({ queryKey: ["paths", from, to, depth], queryFn: () => get({ data: { from: from!, to: to!, maxDepth: Math.min(depth, 6) } }), enabled: !!from && !!to });
  const highlight = useMemo(() => new Set(q.data?.paths[0]?.edges ?? []), [q.data]);
  const pos = useMemo(() => {
    const first = q.data?.paths[0]?.nodes ?? [];
    return (n: GraphNode, i: number) => { const k = first.indexOf(n.id); return k >= 0 ? { x: k * 140, y: 0 } : { x: (i % 6) * 120, y: 140 + Math.floor(i / 6) * 90 }; };
  }, [q.data]);
  const ref = (id: string) => q.data?.nodes.find((n) => n.id === id)?.ref ?? id.slice(0, 8);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <ObjectPicker label="From" value={from} onPick={(id) => set({ from: id })} />
        <ObjectPicker label="To" value={to} onPick={(id) => set({ to: id })} />
        <label className="space-y-1 text-xs"><span className="block">Max hops</span>
          <select value={Math.min(depth, 6)} onChange={(e) => set({ depth: Number(e.target.value) })} className="h-8 rounded-md border bg-background px-2">{[2, 3, 4, 5, 6].map((d) => <option key={d}>{d}</option>)}</select></label>
      </div>
      {q.error && <p className="text-destructive">{errText(q.error)}</p>}
      {q.data && (
        <>
          <p role="status" className="text-sm">{q.data.paths.length ? `${q.data.paths.length} path(s); shortest is ${q.data.shortest} hop(s).` : `Not connected within ${q.data.max_depth} hops.`}</p>
          <ol className="space-y-1 text-xs">{q.data.paths.map((p, i) => <li key={i} className="ident">{p.length} hops: {p.nodes.map(ref).join(" → ")}</li>)}</ol>
          <GraphWithPanel nodes={q.data.nodes} edges={q.data.edges} overlay={overlay} pos={pos} highlight={highlight} label={`${q.data.nodes.length} objects on ${q.data.paths.length} path(s)`} name="thread-paths" onNode={(id) => set({ view: "focus", root: id })} ariaLabel="Path finder graph" />
        </>
      )}
    </div>
  );
}

function Impact({ root, depth, overlay, set }: { root?: string | undefined; depth: number; overlay: Overlay; set: (p: Record<string, unknown>) => void }) {
  const get = useServerFn(getClosure);
  const q = useQuery({ queryKey: ["closure", root, depth], queryFn: () => get({ data: { root: root!, depth: Math.min(depth, 6) } }), enabled: !!root });
  const nodes = useMemo(() => q.data ? [...(q.data.rootNode ? [{ ...q.data.rootNode, depth: 0 }] : []), ...q.data.nodes] : [], [q.data]);
  const pos = useMemo(() => { const m = radialByDepth(nodes.map((n) => ({ id: n.id, depth: n.depth ?? 1 }))); return (n: GraphNode) => m.get(n.id) ?? { x: 0, y: 0 }; }, [nodes]);
  return (
    <div className="space-y-3">
      <ObjectPicker label="Change target" value={root} onPick={(id) => set({ root: id })} />
      {q.error && <p className="text-destructive">{errText(q.error)}</p>}
      {q.data && (
        <>
          <p role="status" className="text-sm">A change to {q.data.rootNode?.ref ?? "this object"} reaches {q.data.count} object(s) within {q.data.depth} hops.</p>
          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <table className="rounded-md border bg-panel"><caption className="label-caps text-left">By type</caption><tbody>
              {Object.entries(q.data.by_type).map(([t, n]) => <tr key={t}><td className="px-2">{t}</td><td className="ident px-2 text-right">{n}</td></tr>)}</tbody></table>
            <table className="rounded-md border bg-panel"><caption className="label-caps text-left">By owner</caption><tbody>
              {Object.entries(q.data.by_owner).map(([t, n]) => <tr key={t}><td className="ident px-2">{t.slice(0, 8)}</td><td className="ident px-2 text-right">{n}</td></tr>)}</tbody></table>
          </div>
          <GraphWithPanel nodes={nodes} edges={q.data.edges} overlay={overlay} pos={pos} label={`${q.data.count} affected · ${q.data.edges.length} edges`} name="thread-impact" onNode={(id) => set({ view: "focus", root: id })} ariaLabel="Blast radius graph" />
        </>
      )}
    </div>
  );
}

function Contradictions({ overlay, onFocus }: { overlay: Overlay; onFocus: (id: string) => void }) {
  const get = useServerFn(getContradictions);
  const q = useQuery({ queryKey: ["contradictions"], queryFn: () => get() });
  const groups = useMemo(() => {
    const m = new Map<string, NonNullable<typeof q.data>>();
    for (const c of q.data ?? []) m.set(c.subject, [...(m.get(c.subject) ?? []), c]);
    return [...m.entries()];
  }, [q.data]);
  const graph = useMemo(() => {
    const nodes = new Map<string, GraphNode>();
    for (const c of q.data ?? []) for (const s of [c.a, c.b]) nodes.set(s.id, { id: s.id, ref: s.ref, type: s.type, title: s.title, family: c.subject, state: "", version: 0, authority_level: "", risk_tier: "1", review_date: "", expires_at: null, owner_id: "", steward_id: null, tombstone: false, open_findings: 0 });
    return { nodes: [...nodes.values()], edges: (q.data ?? []).map((c) => c.edge) };
  }, [q.data]);
  const subjects = groups.map(([s]) => s);
  const pos = useMemo(() => (n: GraphNode, i: number) => { const c = clusterCentre(Math.max(0, subjects.indexOf(n.family)), Math.max(1, subjects.length), 400); const o = spiralOffset(i, 30); return { x: c.x + o.x, y: c.y + o.y }; }, [subjects]);
  if (q.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  return (
    <div className="space-y-3">
      {groups.length === 0 && <p className="text-muted-foreground">No recorded contradictions. Link two objects with “contradicts” to surface one here.</p>}
      {groups.map(([subject, items]) => (
        <section key={subject} className="rounded-md border bg-panel p-3">
          <h3 className="label-caps">{subject}</h3>
          {items.map((c) => (
            <div key={c.edge.id} className="mt-2 grid gap-2 sm:grid-cols-2">
              {[c.a, c.b].map((s) => (
                <button key={s.id} type="button" onClick={() => onFocus(s.id)} className="rounded-md border bg-card p-2 text-left text-sm hover:bg-accent">
                  <span className="ident text-muted-foreground">{s.ref} · {s.type}</span><br />{s.statement}</button>
              ))}
            </div>
          ))}
        </section>
      ))}
      {graph.nodes.length > 0 && <GraphWithPanel nodes={graph.nodes} edges={graph.edges} overlay={overlay} pos={pos} label={`${graph.edges.length} contradiction(s)`} name="thread-contradictions" onNode={onFocus} ariaLabel="Contradiction map" />}
    </div>
  );
}

function Nebula({ cluster, overlay, setCluster, onFocus }: { cluster?: string | undefined; overlay: Overlay; setCluster: (c: string | undefined) => void; onFocus: (id: string) => void }) {
  const get = useServerFn(getNebula);
  const t0 = useRef(performance.now());
  const q = useQuery({ queryKey: ["nebula", cluster], queryFn: () => { t0.current = performance.now(); return get({ data: { cluster } }); } });
  const canvas = useRef<GraphCanvasHandle>(null);
  const [bench, setBench] = useState(false);
  if (bench) return <Benchmark onExit={() => setBench(false)} />;
  if (q.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (q.error) return <p className="text-destructive">{errText(q.error)}</p>;
  const d = q.data!;
  const benchBtn = <Button size="sm" variant="outline" onClick={() => setBench(true)}>Run 20,000-node render benchmark</Button>;
  if (d.level === "clusters") {
    const total = d.clusters.reduce((a, c) => a + c.count, 0);
    const cn: CanvasNode[] = d.clusters.map((c, i) => ({ id: c.cluster, label: `${c.cluster} (${c.count})`, x: c.x, y: c.y, size: 6 + Math.sqrt(c.count) * 2, token: FAMILY_TOKENS[i % FAMILY_TOKENS.length]! }));
    const ce: CanvasEdge[] = d.links.filter((l) => l.from !== l.to).map((l) => ({ id: `${l.from}>${l.to}`, source: l.from, target: l.to, label: String(l.count) }));
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className="ident text-xs text-muted-foreground">{d.clusters.length} clusters · {total.toLocaleString("en-US")} objects · layout computed {d.computed_at ? new Date(d.computed_at).toLocaleString() : "never"} · click a cluster to open it</p>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setCluster("*")}>Show every node</Button>{benchBtn}
        </div>
        <GraphCanvas ref={canvas} nodes={cn} edges={ce} onNode={(c) => setCluster(c)} ariaLabel="Nebula clusters" />
        {d.clusters.length === 0 && <p className="text-muted-foreground">The graph is empty. Record objects in the canon console, then link them.</p>}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => setCluster(undefined)}>← All clusters</Button>{benchBtn}</div>
      <GraphWithPanel nodes={d.nodes} edges={d.edges} overlay={overlay} pos={(n) => ({ x: n.x ?? 0, y: n.y ?? 0 })}
        label={`${cluster === "*" ? "all clusters" : cluster}: ${d.nodes.length.toLocaleString("en-US")} of ${(d.total_nodes ?? 0).toLocaleString("en-US")} nodes · showing ${d.edges.length.toLocaleString("en-US")} of ${d.total_edges.toLocaleString("en-US")} edges`}
        name="thread-nebula" onNode={onFocus} ariaLabel="Nebula nodes" />
    </div>
  );
}

const BENCH_NODES = 20000;
const BENCH_EDGE_BUDGET = 5000;

function Benchmark({ onExit }: { onExit: () => void }) {
  const record = useServerFn(recordRenderBenchmark);
  const canvas = useRef<GraphCanvasHandle>(null);
  const data = useMemo(() => {
    const s = syntheticNebula(BENCH_NODES, 14, 12000);
    const b = applyEdgeBudget(s.edges, BENCH_EDGE_BUDGET);
    return {
      nodes: s.nodes.map<CanvasNode>((n, i) => ({ id: n.id, label: n.label, x: n.x!, y: n.y!, size: 1.5, token: FAMILY_TOKENS[Math.floor(i / (BENCH_NODES / 14)) % FAMILY_TOKENS.length]! })),
      edges: b.shown.map<CanvasEdge>((e) => ({ id: e.id, source: e.from, target: e.to, inferred: true })), label: b.label, total: b.total,
    };
  }, []);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<CanvasStatus>({ state: "loading" });
  async function run() {
    if (status.state !== "ready") return;
    setBusy(true); setResult(null);
    try {
      const frames = await canvas.current!.animateBenchmark(5000);
      if (frames.length < 2) {
        setResult(`Not recorded: only ${frames.length} frame(s) were drawn, so there is nothing valid to measure. Reload the page and try again.`);
        return;
      }
      const fps = frames.map((f) => 1000 / f).sort((a, b) => a - b);
      const median = fps[Math.floor(fps.length / 2)]!;
      const p5 = fps[Math.floor(fps.length * 0.05)]!;
      const r = await record({ data: { dataset: "synthetic", nodes: BENCH_NODES, edges_rendered: data.edges.length, edges_total: data.total,
        fps_median: Math.round(median * 10) / 10, fps_p5: Math.round(p5 * 10) / 10, duration_ms: 5000, first_paint_ms: Math.round(status.ms),
        user_agent: navigator.userAgent.slice(0, 400), device_pixel_ratio: window.devicePixelRatio } });
      setResult(`Median ${median.toFixed(1)} fps, slowest 5% ${p5.toFixed(1)} fps over ${frames.length} frames at ${BENCH_NODES.toLocaleString("en-US")} nodes (${median >= 30 ? "meets" : "misses"} the 30 fps target). Recorded as ledger #${r.seq}.`);
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  }
  const ready = status.state === "ready";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={onExit}>← Back to Nebula</Button>
        <p className="ident text-xs text-muted-foreground">Synthetic dataset · {BENCH_NODES.toLocaleString("en-US")} nodes · {data.label}{ready ? ` · drawn in ${(status.ms / 1000).toFixed(1)} s` : ""}</p>
        <Button size="sm" className="ml-auto" disabled={busy || !ready} onClick={run}>{busy ? "Measuring for 5 s… (the graph zooms and turns)" : ready ? "Measure and record" : "Waiting for the graph…"}</Button>
      </div>
      {result && <p role="status" className="text-sm">{result}</p>}
      <GraphCanvas ref={canvas} nodes={data.nodes} edges={data.edges} labels={false} onStatus={setStatus} ariaLabel="Render benchmark, 20,000 synthetic nodes" />
    </div>
  );
}

function Integrity({ onFocus }: { onFocus: (id: string) => void }) {
  const get = useServerFn(getIntegrity);
  const sweep = useServerFn(runGraphSweep);
  const getEv = useServerFn(getPhase2Evidence);
  const runEv = useServerFn(runPhase2Evidence);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["integrity"], queryFn: () => get() });
  const ev = useQuery({ queryKey: ["phase2-evidence"], queryFn: () => getEv() });
  const [busy, setBusy] = useState(false);
  const p = ev.data?.payload as { selftest?: { ok: boolean; checks: { check: string; ok: boolean; detail: string }[] }; live_graph?: Record<string, unknown>; render_benchmark?: Record<string, unknown>; pending_live_adapter?: string[] } | undefined;
  const d = q.data;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="space-y-2 rounded-md border bg-panel p-3">
        <div className="flex items-center"><h2 className="text-sm font-semibold">Reachability, cycles and canon drift</h2>
          <Button size="sm" variant="outline" className="ml-auto" disabled={busy} onClick={async () => {
            setBusy(true); try { await sweep(); toast.success("Sweep recorded"); qc.invalidateQueries(); } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
          }}>Run sweep</Button></div>
        {d && (
          <>
            <dl className="grid grid-cols-3 gap-2 text-xs">
              {[["Live objects", d.orphans.live_objects], ["Unreachable", d.orphans.count], ["Cycles", d.cycles.length],
                ["Canon drift rate", d.drift.drift_rate], ["Changes via path", `${d.drift.via_change_path}/${d.drift.content_changes}`], ["Open changes", d.drift.open_changes]]
                .map(([k, v]) => <div key={String(k)}><dt className="label-caps">{k}</dt><dd className="ident text-base">{String(v)}</dd></div>)}
            </dl>
            {d.orphans.count > 0 && <><h3 className="label-caps">Unreachable objects (no edges)</h3>
              <ul className="text-xs">{d.orphans.nodes.map((n) => <li key={n.id}><button type="button" className="underline" onClick={() => onFocus(n.id)}>{n.ref}</button> {n.title}</li>)}</ul></>}
            {d.cycles.length > 0 && <><h3 className="label-caps">Cycles</h3>
              <ul className="text-xs">{d.cycles.map((c, i) => <li key={i} className="ident text-destructive">{c.verb}: {c.refs.join(" → ")}</li>)}</ul></>}
            {d.drift.silent_changes.length > 0 && <p className="text-xs text-destructive">Silent canon changes: {d.drift.silent_changes.map((s) => `${s.ref} v${s.version}`).join(", ")}</p>}
            {d.drift.without_steward.length > 0 && <p className="text-xs text-warn">Canon without a steward: {d.drift.without_steward.map((s) => s.ref).join(", ")}</p>}
            {d.drift.review_overdue.length > 0 && <p className="text-xs text-warn">Review overdue: {d.drift.review_overdue.map((s) => s.ref).join(", ")}</p>}
          </>
        )}
      </section>
      <section className="space-y-2 rounded-md border bg-panel p-3">
        <div className="flex items-center"><h2 className="text-sm font-semibold">Phase 2 exit evidence</h2>
          <Button size="sm" variant="outline" className="ml-auto" disabled={busy} onClick={async () => {
            setBusy(true); try { await runEv(); toast.success("Exit evidence recorded"); qc.invalidateQueries(); } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
          }}>Re-run and record</Button></div>
        {!p && <p className="text-xs text-muted-foreground">Not yet recorded.</p>}
        {p?.selftest && (
          <>
            <p className="text-xs"><span className={p.selftest.ok ? "text-ok" : "text-destructive"}>{p.selftest.checks.filter((c) => c.ok).length}/{p.selftest.checks.length} checks pass</span>
              <span className="ident text-muted-foreground"> · ledger #{ev.data?.seq}</span></p>
            <ul className="space-y-1">{p.selftest.checks.map((c) => (
              <li key={c.check} className="grid grid-cols-[1.5rem_1fr] gap-1 text-xs">
                <span className={c.ok ? "text-ok" : "text-destructive"} aria-label={c.ok ? "pass" : "fail"}>{c.ok ? "✓" : "✗"}</span>
                <span><span className="ident">{c.check}</span> <span className="text-muted-foreground">{c.detail}</span></span></li>))}</ul>
            <p className="text-xs"><span className="label-caps">Render benchmark</span> <span className="ident">{JSON.stringify(p.render_benchmark)}</span></p>
            <p className="text-xs text-warn">pending_live_adapter: {p.pending_live_adapter?.join("; ")}</p>
          </>
        )}
      </section>
    </div>
  );
}
