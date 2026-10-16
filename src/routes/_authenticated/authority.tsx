import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getAuthorityOverview, evaluateAction, runPhase3Evidence } from "@/lib/authority.functions";
import { listObjects } from "@/lib/canon.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/authority")({
  head: () => ({
    meta: [
      { title: "Authority and guardrails · THREAD" },
      { name: "description", content: "Evaluate actions against the THREAD authority engine, guardrails and prohibited conditions." },
      { property: "og:title", content: "Authority and guardrails · THREAD" },
      { property: "og:description", content: "Evaluate actions against the THREAD authority engine, guardrails and prohibited conditions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthorityPage,
});

function errText(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  try { const j = JSON.parse(m); return `${j.code}: ${j.explanation}`; } catch { return m; }
}
const DIMS = ["intent_alignment", "simulation_performance", "adversarial_results", "security_privacy_evidence", "accessibility_reliability",
  "capability_pattern_conformance", "reversibility_rollback", "impact_assessment", "shadow_results", "data_quality_lineage"] as const;
type Outcome = Awaited<ReturnType<typeof evaluateAction>>;

function AuthorityPage() {
  const ov = useServerFn(getAuthorityOverview);
  const overview = useQuery({ queryKey: ["authority"], queryFn: () => ov() });
  const d = overview.data;
  return (
    <main className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section className="min-w-0 space-y-4">
        <Evaluate />
        <Evidence />
      </section>
      <section className="space-y-4" aria-label="Engine configuration">
        <div className="rounded-md border bg-panel p-3">
          <h2 className="label-caps mb-2">Guardrails as code (Part 6.6)</h2>
          <ul className="space-y-1 text-sm">
            {(d?.guardrails ?? []).map((g) => (
              <li key={g.id} className="flex flex-wrap items-baseline gap-2">
                <span className={g.enforcement === "enforcing" ? "ident text-foreground" : "ident text-muted-foreground"}>{g.enforcement}</span>
                <span>{g.category.replaceAll("_", " ")}</span>
                <span className="ident text-xs text-muted-foreground">{g.evaluator} v{g.version}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border bg-panel p-3 text-sm">
          <h2 className="label-caps mb-2">Published confidence rule (Part 6.3)</h2>
          {(d?.rules ?? []).map((r) => {
            const def = r.definition as { text?: string; rule_object_id?: string };
            return (
              <div key={r.version}>
                <p><span className="ident">{r.version}</span> — {def.text}</p>
                {def.rule_object_id && <Link to="/canon" search={{ id: def.rule_object_id }} className="text-xs underline">Open the Rule object and its history</Link>}
              </div>
            );
          })}
        </div>
        <div className="rounded-md border bg-panel p-3 text-sm">
          <h2 className="label-caps mb-2">Authority ladder (Part 6.2)</h2>
          <p className="ident text-xs">{d?.ladder.join(" → ")}</p>
          <p className="mt-2 text-xs text-muted-foreground">Automatic demotion on: {d?.triggers.map((t) => t.replaceAll("_", " ")).join(" · ")}</p>
          <p className="mt-2 text-xs text-muted-foreground">Provisional promotion thresholds: {d && Object.entries(d.thresholds).map(([k, v]) => `${k.replaceAll("_", " ")} ${v}`).join(" · ")}</p>
          <h3 className="label-caps mt-3 mb-1">Recent authority changes</h3>
          <ul className="space-y-0.5 text-xs">
            {(d?.history ?? []).length === 0 && <li className="text-muted-foreground">None yet.</li>}
            {(d?.history ?? []).slice(0, 12).map((h) => (
              <li key={h.id}><span className="ident">{h.from_level} → {h.to_level}</span> {h.cause} {h.trigger ? `(${h.trigger.replaceAll("_", " ")})` : ""}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border bg-panel p-3 text-sm">
          <h2 className="label-caps mb-2">Prohibited conditions (Part 6.7)</h2>
          <ul className="list-disc space-y-0.5 pl-4 text-xs">{d && Object.values(d.prohibited).map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
        <div className="rounded-md border bg-panel p-3 text-sm">
          <h2 className="label-caps mb-2">Recent policy evaluations</h2>
          <ul className="space-y-1 text-xs">
            {(d?.evaluations ?? []).map((e) => (
              <li key={e.id}><Link to="/canon" search={{ id: e.id }} className="ident underline">{e.human_ref}</Link> {e.title}</li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

function Evaluate() {
  const qc = useQueryClient();
  const list = useServerFn(listObjects);
  const evaluate = useServerFn(evaluateAction);
  const [q, setQ] = useState("");
  const objs = useQuery({ queryKey: ["objects", q, false], queryFn: () => list({ data: { q: q || undefined } }) });
  const [objectId, setObjectId] = useState("");
  const [action, setAction] = useState("release to members");
  const [conf, setConf] = useState(0.85);
  const [refs, setRefs] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<Outcome | null>(null);
  async function run() {
    if (!objectId) { toast.error("Choose the object the action is about."); return; }
    setBusy(true);
    try {
      const evidence = refs ? [objectId] : [];
      const dimensions = Object.fromEntries(DIMS.map((k) => [k, { value: conf, evidence_refs: evidence }]));
      const r = await evaluate({ data: { object_id: objectId, action, dimensions, owner_confidence: conf, content_text: text || undefined, flags: {}, agent: true, risk: {} } });
      setOut(r);
      qc.invalidateQueries({ queryKey: ["authority"] });
      qc.invalidateQueries({ queryKey: ["decisions"] });
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  }
  return (
    <div className="rounded-md border bg-panel p-3">
      <h2 className="label-caps mb-2">Ask the authority engine</h2>
      <p className="mb-3 text-xs text-muted-foreground">Every answer is recorded as a policy evaluation. If a human must decide, a decision request is opened in the Decisions page.</p>
      <div className="grid gap-2 text-sm">
        <Label htmlFor="obj-q">Object</Label>
        <Input id="obj-q" placeholder="Search objects" value={q} onChange={(e) => setQ(e.target.value)} className="h-8" />
        <select aria-label="Object" className="h-8 w-full min-w-0 rounded-md border bg-background px-2 text-sm" value={objectId} onChange={(e) => setObjectId(e.target.value)}>
          <option value="">Choose…</option>
          {(objs.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.human_ref} · {o.type} · {o.title} (tier {o.risk_tier}, {o.authority_level})</option>)}
        </select>
        <Label htmlFor="act">Action</Label>
        <Input id="act" value={action} onChange={(e) => setAction(e.target.value)} className="h-8" />
        <Label htmlFor="conf">Evidence strength across all dimensions: {conf.toFixed(2)}</Label>
        <input id="conf" type="range" min={0} max={1} step={0.05} value={conf} onChange={(e) => setConf(Number(e.target.value))} />
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={refs} onChange={(e) => setRefs(e.target.checked)} /> evidence is attached (without evidence a dimension counts as 0)</label>
        <Label htmlFor="txt">Content the action would send (optional, never stored)</Label>
        <Textarea id="txt" rows={2} value={text} onChange={(e) => setText(e.target.value)} />
        <Button onClick={run} disabled={busy} className="justify-self-start">{busy ? "Evaluating…" : "Evaluate"}</Button>
      </div>
      {out && (
        <div className="mt-3 space-y-1 border-t pt-3 text-sm" aria-live="polite">
          <p><span className="ident">{out.outcome.treatment.replaceAll("_", " ")}</span> — {out.outcome.explanation}</p>
          <p className="text-xs text-muted-foreground">Confidence {out.outcome.confidence.overall} ({out.outcome.confidence.band}) · risk tier {out.risk.computed_tier} computed ({out.risk.reasons.join("; ") || "no raising inputs"}) · content tier {out.outcome.content_tier} · rules {out.outcome.rule_ids.join(", ")}</p>
          {out.outcome.conditions.length > 0 && <p className="text-xs">Conditions: {out.outcome.conditions.join("; ")}</p>}
          <p className="text-xs">Recorded as <Link to="/canon" search={{ id: out.policy_evaluation.id }} className="ident underline">{out.policy_evaluation.human_ref}</Link>
            {out.decision_request && <> · decision request <Link to="/decisions" className="ident underline">{out.decision_request.human_ref}</Link></>}</p>
        </div>
      )}
    </div>
  );
}

function Evidence() {
  const run = useServerFn(runPhase3Evidence);
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Record<string, unknown> | null>(null);
  async function go() {
    setBusy(true);
    try { setR(JSON.parse(await run()) as Record<string, unknown>); } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  }
  const st = r?.["selftest"] as { passed: boolean; checks: Array<{ name: string; pass: boolean }> } | undefined;
  const client = r?.["client"] as { matrix: Array<{ name: string; expected: string; got: string; pass: boolean }>; phi_pan: { recall: number; precision: number; positives: number; items: number; misses: number } } | undefined;
  return (
    <div className="rounded-md border bg-panel p-3 text-sm">
      <h2 className="label-caps mb-2">Phase 3 exit evidence</h2>
      <Button onClick={go} disabled={busy} variant="outline">{busy ? "Running…" : "Run and record"}</Button>
      {r && (
        <div className="mt-3 space-y-2" aria-live="polite">
          <p>Recorded as ledger #{String(r["ledger_seq"])}.</p>
          <h3 className="label-caps">Decision matrix (risk × confidence × consequence)</h3>
          <ul className="text-xs">{client?.matrix.map((m) => <li key={m.name}>{m.pass ? "✓" : "✗"} {m.name} → {m.got.replaceAll("_", " ")}</li>)}</ul>
          <h3 className="label-caps">Database checks</h3>
          <ul className="text-xs">{st?.checks.map((c) => <li key={c.name}>{c.pass ? "✓" : "✗"} {c.name}</li>)}</ul>
          {client && <p className="text-xs">PHI/PAN recall {(client.phi_pan.recall * 100).toFixed(1)}% over {client.phi_pan.positives} labelled positives ({client.phi_pan.items} items), precision {(client.phi_pan.precision * 100).toFixed(1)}%, {client.phi_pan.misses} misses. Published as a rendition.</p>}
        </div>
      )}
    </div>
  );
}
