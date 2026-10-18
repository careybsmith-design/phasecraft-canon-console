/**
 * WebGL graph renderer (sigma.js), loaded only in the browser.
 * Positions always come from the server or a deterministic placement; the
 * browser never solves a large layout (Part 16.5 rule 1).
 * Colours are read from the design tokens at runtime, never hardcoded.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface CanvasNode { id: string; label: string; x: number; y: number; size?: number; token: string; tombstone?: boolean }
export interface CanvasEdge { id: string; source: string; target: string; inferred?: boolean; highlight?: boolean; label?: string }
export interface GraphCanvasHandle { exportPng: (name: string) => void; animateBenchmark: (ms: number) => Promise<number[]> }

const colourCache = new Map<string, string>();
/** Resolves a CSS custom property (any colour syntax) to an rgb() string sigma can parse. */
export function tokenColour(token: string): string {
  const hit = colourCache.get(token);
  if (hit) return hit;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim() || "gray";
  const c = document.createElement("canvas"); c.width = c.height = 1;
  const ctx = c.getContext("2d");
  if (!ctx) return raw;
  ctx.fillStyle = raw; ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  const out = `rgb(${r},${g},${b})`;
  colourCache.set(token, out);
  return out;
}

export type CanvasStatus = { state: "loading" } | { state: "ready"; ms: number } | { state: "error"; message: string };

/** True when the browser can create a WebGL context (sigma needs one). */
function webglAvailable(): string | null {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    if (!gl) return "This browser could not start WebGL, which the graph needs. Turn on hardware acceleration (Edge: Settings → System and performance → Use graphics acceleration) and reload.";
    (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  } catch (e) { return `WebGL check failed: ${(e as Error).message}`; }
}

interface Props {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  onNode?: (id: string) => void;
  onEdge?: (id: string) => void;
  onStatus?: (s: CanvasStatus) => void;
  labels?: boolean;
  className?: string;
  ariaLabel: string;
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, Props>(function GraphCanvas({ nodes, edges, onNode, onEdge, onStatus, labels = true, className, ariaLabel }, ref) {
  const el = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sigmaRef = useRef<any>(null);
  const handlers = useRef({ onNode, onEdge, onStatus });
  handlers.current = { onNode, onEdge, onStatus };
  const [status, setStatusState] = useState<CanvasStatus>({ state: "loading" });
  const setStatus = (s: CanvasStatus) => { setStatusState(s); handlers.current.onStatus?.(s); };

  useEffect(() => {
    let killed = false;
    const t0 = performance.now();
    setStatus({ state: "loading" });
    (async () => {
      try {
        const noGl = webglAvailable();
        if (noGl) throw new Error(noGl);
        const [{ default: Sigma }, { default: Graph }] = await Promise.all([import("sigma"), import("graphology")]);
        if (killed || !el.current) return;
        const g = new Graph({ multi: true, type: "directed" });
        for (const n of nodes) {
          if (g.hasNode(n.id)) continue;
          g.addNode(n.id, { x: n.x, y: n.y, size: n.size ?? 4, label: n.label, color: tokenColour(n.tombstone ? "tombstone" : n.token) });
        }
        const edgeColour = tokenColour("muted-foreground");
        const inferredColour = tokenColour("border");
        const hiColour = tokenColour("primary");
        for (const e of edges) {
          if (!g.hasNode(e.source) || !g.hasNode(e.target) || g.hasEdge(e.id)) continue;
          g.addEdgeWithKey(e.id, e.source, e.target, {
            size: e.highlight ? 2.5 : e.inferred ? 0.5 : 1, color: e.highlight ? hiColour : e.inferred ? inferredColour : edgeColour, label: e.label, type: "arrow",
          });
        }
        const s = new Sigma(g, el.current, {
          renderLabels: labels, renderEdgeLabels: false, enableEdgeEvents: true, labelRenderedSizeThreshold: 6,
          labelColor: { color: tokenColour("foreground") }, defaultEdgeType: "arrow", allowInvalidContainer: true,
        });
        if (killed) { s.kill(); return; }
        s.on("clickNode", ({ node }: { node: string }) => handlers.current.onNode?.(node));
        s.on("clickEdge", ({ edge }: { edge: string }) => handlers.current.onEdge?.(edge));
        s.on("enterNode", ({ node }: { node: string }) => {
          const neighbours = new Set([node, ...g.neighbors(node)]);
          s.setSetting("nodeReducer", (id, data) => neighbours.has(id) ? data : { ...data, color: inferredColour, label: "", zIndex: 0 });
          s.setSetting("edgeReducer", (id, data) => ({ ...data, hidden: !g.hasExtremity(id, node) }));
        });
        s.on("leaveNode", () => { s.setSetting("nodeReducer", null); s.setSetting("edgeReducer", null); });
        sigmaRef.current = s;
        setStatus({ state: "ready", ms: performance.now() - t0 });
      } catch (e) {
        console.error("GraphCanvas failed to start", e);
        if (!killed) setStatus({ state: "error", message: (e as Error)?.message || String(e) });
      }
    })();
    return () => { killed = true; sigmaRef.current?.kill(); sigmaRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, labels]);

  useImperativeHandle(ref, () => ({
    exportPng(name: string) {
      const s = sigmaRef.current; if (!s) return;
      const layers = s.getCanvases() as Record<string, HTMLCanvasElement>;
      const first = Object.values(layers)[0]; if (!first) return;
      const out = document.createElement("canvas"); out.width = first.width; out.height = first.height;
      const ctx = out.getContext("2d"); if (!ctx) return;
      ctx.fillStyle = tokenColour("background"); ctx.fillRect(0, 0, out.width, out.height);
      for (const c of Object.values(layers)) ctx.drawImage(c, 0, 0);
      const a = document.createElement("a"); a.href = out.toDataURL("image/png"); a.download = `${name}.png`; a.click();
    },
    async animateBenchmark(ms: number) {
      const s = sigmaRef.current; if (!s) return [];
      const cam = s.getCamera();
      const frames: number[] = [];
      const start = performance.now(); let last = start;
      await new Promise<void>((resolve) => {
        const tick = (t: number) => {
          frames.push(t - last); last = t;
          const p = (t - start) / ms;
          cam.setState({ ratio: 1 + 0.6 * Math.sin(p * Math.PI * 2), angle: p * Math.PI * 0.5, x: 0.5, y: 0.5 });
          s.refresh();
          if (t - start < ms) requestAnimationFrame(tick); else resolve();
        };
        requestAnimationFrame(tick);
      });
      cam.setState({ ratio: 1, angle: 0, x: 0.5, y: 0.5 });
      return frames.slice(1);
    },
  }), []);

  return (
    <div className="relative">
      <div ref={el} role="img" aria-label={ariaLabel} className={className ?? "thread-graph-canvas"} />
      {status.state !== "ready" && (
        <div role="status" className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm">
          {status.state === "loading"
            ? <span className="text-muted-foreground">Drawing {nodes.length.toLocaleString("en-US")} nodes…</span>
            : <span className="text-destructive">The graph could not be drawn. {status.message}</span>}
        </div>
      )}
    </div>
  );
});
