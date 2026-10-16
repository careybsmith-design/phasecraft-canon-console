import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { z } from "zod";
import { getFramingView, type FvEdge } from "@/lib/framing.functions";
import { FRAMING_VIEWS, FRAMING_VIEW_LABELS } from "@/domain/framing";
import {
  GraphCanvas,
  type CanvasNode,
  type CanvasEdge,
  type GraphCanvasHandle,
} from "@/components/graph/GraphCanvas";
import { Button } from "@/components/ui/button";
import { errText } from "./framing.index";

const Search = z.object({
  view: z.enum(FRAMING_VIEWS).default("need_web"),
  session: z.string().uuid().optional(),
  root: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/framing/views")({
  validateSearch: Search,
  head: () => ({
    meta: [
      { title: "Need and dependency web · THREAD" },
      {
        name: "description",
        content:
          "Need Web, Decomposition Tree, Dependency Web, Contradiction Map, Unresolved Frontier and more for framing output.",
      },
      { property: "og:title", content: "Need and dependency web · THREAD" },
      {
        property: "og:description",
        content:
          "See how needs and behaviour connect, what conflicts and what is not yet understood.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Views,
});

const TYPE_TOKEN: Record<string, string> = {
  NeedStatement: "chart-1",
  BehaviorStatement: "chart-2",
  ComposableCapability: "chart-3",
  ConfirmedDecision: "chart-4",
  OpenQuestion: "warn",
  Assumption: "chart-5",
  FramingSession: "primary",
  TestRun: "ok",
};

function Views() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/framing/views" });
  const get = useServerFn(getFramingView);
  const q = useQuery({
    queryKey: ["framing-view", s.view, s.session, s.root],
    queryFn: () => get({ data: { view: s.view, session: s.session, root: s.root } }),
  });
  const [edge, setEdge] = useState<FvEdge | null>(null);
  const [hideInferred, setHideInferred] = useState(false);
  const canvas = useRef<GraphCanvasHandle>(null);
  const nodes: CanvasNode[] = useMemo(
    () =>
      (q.data?.nodes ?? []).map((n) => ({
        id: n.id,
        label: `${n.draft ? "◌ " : ""}${n.ref} ${n.title.slice(0, 40)}`,
        x: n.x,
        y: n.y,
        size: n.type === "FramingSession" ? 10 : 6,
        token: n.draft ? "muted-foreground" : (TYPE_TOKEN[n.type] ?? "ring"),
      })),
    [q.data],
  );
  const edges: CanvasEdge[] = useMemo(
    () =>
      (q.data?.edges ?? [])
        .filter((e) => !(hideInferred && e.inferred))
        .map((e) => ({
          id: e.id,
          source: e.from,
          target: e.to,
          inferred: e.inferred,
          label: e.verb,
          highlight: e.verb === "contradicts",
        })),
    [q.data, hideInferred],
  );
  const byId = new Map((q.data?.edges ?? []).map((e) => [e.id, e]));
  const nodeRef = new Map((q.data?.nodes ?? []).map((n) => [n.id, n.ref]));
  return (
    <main className="space-y-3 p-4">
      <nav aria-label="Framing views" className="flex flex-wrap gap-2 text-sm">
        <Link to="/framing" className="underline">
          Sessions
        </Link>
        {FRAMING_VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={s.view === v}
            className={`rounded border px-2 ${s.view === v ? "border-primary text-primary" : ""}`}
            onClick={() => navigate({ search: { ...s, view: v } })}
          >
            {FRAMING_VIEW_LABELS[v]}
          </button>
        ))}
      </nav>
      {s.view === "impact_overlay" && !s.root && (
        <p className="text-sm text-muted-foreground">
          Pick a need or behaviour statement from the list below to see what must be re-verified if
          it changes.
        </p>
      )}
      {s.view === "session_constellation" && !s.session && (
        <p className="text-sm text-muted-foreground">Open this view from a session page.</p>
      )}
      {q.error && <p className="text-destructive">{errText(q.error)}</p>}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          {nodes.length} nodes · {edges.length} edges
        </span>
        <span>◌ = draft (not authoritative) · dashed = inferred or co-occurrence</span>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={hideInferred}
            onChange={(e) => setHideInferred(e.target.checked)}
          />
          hide inferred
        </label>
        <Button
          size="sm"
          variant="outline"
          onClick={() => canvas.current?.exportPng(`thread-${s.view}`)}
        >
          Export image
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const b = new Blob([JSON.stringify(q.data, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(b);
            a.download = `thread-${s.view}.json`;
            a.click();
          }}
        >
          Export data
        </Button>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="h-[60vh] rounded-md border bg-panel">
          {nodes.length > 0 ? (
            <GraphCanvas
              ref={canvas}
              nodes={nodes}
              edges={edges}
              ariaLabel={FRAMING_VIEW_LABELS[s.view]}
              className="h-full w-full"
              onNode={(id) =>
                s.view === "impact_overlay" || s.view === "need_web"
                  ? navigate({ search: { ...s, view: "impact_overlay", root: id } })
                  : undefined
              }
              onEdge={(id) => setEdge(byId.get(id) ?? null)}
            />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Nothing to show in this view yet.</p>
          )}
        </div>
        <aside className="space-y-3 text-sm">
          {edge && (
            <div className="rounded-md border bg-panel p-3" aria-live="polite">
              <h2 className="label-caps">Why is this connected?</h2>
              <dl className="mt-1 grid grid-cols-[6rem_1fr] gap-1 text-xs">
                <dt>Verb</dt>
                <dd>
                  {edge.verb}
                  {edge.kind ? ` (${edge.kind})` : ""}
                </dd>
                <dt>From → to</dt>
                <dd>
                  {nodeRef.get(edge.from)} → {nodeRef.get(edge.to)}
                </dd>
                <dt>Origin</dt>
                <dd>
                  {edge.source}
                  {edge.inferred ? " — inferred, never auto-confirmed" : ""}
                </dd>
                <dt>Confidence</dt>
                <dd>{edge.confidence ?? "—"}</dd>
                <dt>Why</dt>
                <dd>{edge.rationale}</dd>
                <dt>By</dt>
                <dd>
                  {edge.created_by?.kind} {edge.created_by?.id?.slice(0, 8)}
                </dd>
                <dt>When</dt>
                <dd>{new Date(edge.created_at).toLocaleString()}</dd>
              </dl>
            </div>
          )}
          <div className="rounded-md border bg-panel p-3">
            <h2 className="label-caps">As a list</h2>
            <ul className="mt-1 max-h-[50vh] space-y-1 overflow-auto text-xs">
              {(q.data?.list ?? []).map((l) => {
                const n = q.data?.nodes.find((x) => x.ref === l.ref);
                return (
                  <li key={l.ref}>
                    <button
                      type="button"
                      className="text-left underline-offset-2 hover:underline"
                      onClick={() =>
                        n && navigate({ search: { ...s, view: "impact_overlay", root: n.id } })
                      }
                    >
                      <span className="ident">{l.ref}</span> {l.title}
                    </button>{" "}
                    <span className="text-muted-foreground">
                      · {l.type} · {l.why}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
