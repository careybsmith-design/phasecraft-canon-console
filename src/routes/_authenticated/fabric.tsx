import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listFabric, searchCapabilityFabric, recordReuseCheck, createCapability, publishReusableCapability,
  composeCapabilities, recordCapabilityUse, runFabricSweep, runPhase4Evidence,
} from "@/lib/fabric.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/fabric")({
  head: () => ({
    meta: [
      { title: "Capability Fabric · THREAD" },
      { name: "description", content: "Find, reuse, compose, publish and retire reusable business capabilities." },
      { property: "og:title", content: "Capability Fabric · THREAD" },
      { property: "og:description", content: "Find, reuse, compose, publish and retire reusable business capabilities." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FabricPage,
});

function errText(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  try { const j = JSON.parse(m); return `${j.code}: ${j.explanation}`; } catch { return m; }
}
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
type Fabric = Awaited<ReturnType<typeof listFabric>>;

function FabricPage() {
  const lf = useServerFn(listFabric);
  const q = useQuery({ queryKey: ["fabric"], queryFn: () => lf() });
  return (
    <main className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="min-w-0 space-y-4">
        <Search />
        <NewCapability requiredKeys={q.data?.required_keys ?? []} />
        <Evidence />
      </section>
      <section className="min-w-0 space-y-4">
        <Capabilities data={q.data} />
        <Compositions data={q.data} />
        <ReuseChecks data={q.data} />
      </section>
    </main>
  );
}

function Search() {
  const qc = useQueryClient();
  const search = useServerFn(searchCapabilityFabric);
  const record = useServerFn(recordReuseCheck);
  const [outcome, setOutcome] = useState("");
  const [inputs, setInputs] = useState("");
  const [outputs, setOutputs] = useState("");
  const [domain, setDomain] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof search>> | null>(null);
  const [gaps, setGaps] = useState<Record<string, string>>({});
  const [decision, setDecision] = useState<"reuse_as_is" | "compose_existing" | "create_new">("create_new");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const shape = () => ({ outcome, inputs: list(inputs), outputs: list(outputs), domain });
  async function go() {
    if (!outcome.trim()) { toast.error("Describe the outcome you need."); return; }
    setBusy(true);
    try { const r = await search({ data: shape() }); setResults(r); setDecision(r.length ? "reuse_as_is" : "create_new"); }
    catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true);
    try {
      const extra = Object.fromEntries(Object.entries(gaps).map(([k, v]) => [k, list(v)]).filter(([, v]) => (v as string[]).length));
      const r = await record({ data: { intent_shape: shape(), decision, rationale, extra_gaps: extra } });
      toast.success(`Reuse check recorded (${r.results.length} result(s))`);
      qc.invalidateQueries({ queryKey: ["fabric"] });
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  }
  return (
    <div className="rounded-md border bg-panel p-3 text-sm">
      <h2 className="label-caps mb-2">Search before you build (Part 7.4)</h2>
      <div className="grid gap-2">
        <Label htmlFor="f-out">Outcome you need</Label>
        <Input id="f-out" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Route incoming claims to the right queue" className="h-8" />
        <div className="grid gap-2 sm:grid-cols-3">
          <div><Label htmlFor="f-in">Inputs (comma separated)</Label><Input id="f-in" value={inputs} onChange={(e) => setInputs(e.target.value)} className="h-8" /></div>
          <div><Label htmlFor="f-o">Outputs</Label><Input id="f-o" value={outputs} onChange={(e) => setOutputs(e.target.value)} className="h-8" /></div>
          <div><Label htmlFor="f-d">Domain</Label><Input id="f-d" value={domain} onChange={(e) => setDomain(e.target.value)} className="h-8" /></div>
        </div>
        <Button onClick={go} disabled={busy} className="justify-self-start">Search the fabric</Button>
      </div>
      {results && (
        <div className="mt-3 space-y-2 border-t pt-3" aria-live="polite">
          {results.length === 0 && <p className="text-muted-foreground">No published capability matches. You may create a new one, with a rationale.</p>}
          {results.map((r) => (
            <div key={r.capability_id} className="rounded border p-2">
              <p><span className="ident">{r.human_ref}</span> {r.title} — match {Number(r.match_score).toFixed(2)}, {r.reuse_mode.replaceAll("_", " ")}</p>
              <p className="text-xs text-muted-foreground">Gaps: {r.gaps.length ? r.gaps.join("; ") : "none recorded"}</p>
              <Input aria-label={`Extra gaps for ${r.human_ref}`} placeholder="Record more gaps (comma separated)" value={gaps[r.capability_id] ?? ""} onChange={(e) => setGaps({ ...gaps, [r.capability_id]: e.target.value })} className="mt-1 h-7 text-xs" />
            </div>
          ))}
          <Label htmlFor="f-dec">Decision</Label>
          <select id="f-dec" className="h-8 w-full rounded-md border bg-background px-2" value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
            <option value="reuse_as_is">Reuse as is</option><option value="compose_existing">Compose existing</option><option value="create_new">Create new</option>
          </select>
          <Label htmlFor="f-rat">Rationale</Label>
          <Textarea id="f-rat" rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} />
          <Button onClick={save} disabled={busy} variant="outline">Record reuse check</Button>
        </div>
      )}
    </div>
  );
}

const TEMPLATE = (keys: string[]) => JSON.stringify(Object.fromEntries(keys.map((k) => [k,
  k === "input_schema" || k === "output_schema" ? { fields: [] } :
  k === "minimum_use_threshold" ? { uses: 10, window_days: 30 } :
  k === "operating_cost_ceiling" ? { amount: 100, window_days: 30 } : ""])), null, 2);

function NewCapability({ requiredKeys }: { requiredKeys: string[] }) {
  const qc = useQueryClient();
  const create = useServerFn(createCapability);
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(body || TEMPLATE(requiredKeys)); } catch { toast.error("The contract fields are not valid JSON."); return; }
    setBusy(true);
    try {
      const r = await create({ data: { title, statement, machine_description: statement, body: parsed, risk_tier: "1", consequence_class: "reversible", data_classification: "internal",
        review_date: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10) } });
      toast.success(`Recorded ${r.human_ref}`); setTitle(""); setStatement(""); setBody("");
      qc.invalidateQueries({ queryKey: ["fabric"] });
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  }
  return (
    <details className="rounded-md border bg-panel p-3 text-sm">
      <summary className="label-caps cursor-pointer">Record a new capability</summary>
      <div className="mt-2 grid gap-2">
        <Label htmlFor="c-t">Title</Label><Input id="c-t" value={title} onChange={(e) => setTitle(e.target.value)} className="h-8" />
        <Label htmlFor="c-s">What business result it promises</Label><Textarea id="c-s" rows={2} value={statement} onChange={(e) => setStatement(e.target.value)} />
        <Label htmlFor="c-b">Contract fields (Part 7.2 and 7.6). Fill every field before publishing.</Label>
        <Textarea id="c-b" rows={10} className="ident text-xs" value={body || TEMPLATE(requiredKeys)} onChange={(e) => setBody(e.target.value)} />
        <Button onClick={go} disabled={busy || !title || !statement} className="justify-self-start">Record</Button>
      </div>
    </details>
  );
}

function Capabilities({ data }: { data: Fabric | undefined }) {
  const qc = useQueryClient();
  const publish = useServerFn(publishReusableCapability);
  const use = useServerFn(recordCapabilityUse);
  const compose = useServerFn(composeCapabilities);
  const sweep = useServerFn(runFabricSweep);
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const act = async (f: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await f(); toast.success(ok); qc.invalidateQueries({ queryKey: ["fabric"] }); } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-md border bg-panel p-3 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="label-caps">Capabilities</h2>
        <Button size="sm" variant="outline" className="ml-auto" disabled={busy} onClick={() => act(async () => { const r = JSON.parse(await sweep()); toast(`Retired ${r.retired.length}, flagged ${r.flagged.length}`); }, "Lifecycle sweep done")}>Run lifecycle sweep</Button>
      </div>
      {(data?.capabilities ?? []).length === 0 && <p className="text-muted-foreground">No capabilities yet.</p>}
      <ul className="space-y-2">
        {(data?.capabilities ?? []).map((c) => (
          <li key={c.id} className="rounded border p-2">
            <div className="flex flex-wrap items-baseline gap-2">
              {c.published && c.lifecycle_state !== "retired" && <input type="checkbox" aria-label={`Select ${c.human_ref} for composition`} checked={sel.includes(c.id)} onChange={(e) => setSel(e.target.checked ? [...sel, c.id] : sel.filter((x) => x !== c.id))} />}
              <Link to="/canon" search={{ id: c.id }} className="ident underline">{c.human_ref}</Link>
              <span>{c.title}</span>
              <span className="ident text-xs text-muted-foreground">{c.lifecycle_state} · {c.authority_level} · tier {c.risk_tier}{c.published ? " · published" : ""}</span>
            </div>
            <p className="text-xs text-muted-foreground">Last 30 days: {c.usage.uses} uses, cost {c.usage.cost.toFixed(2)}, {c.usage.failures} failures · retirement cost: {c.retirement_cost.dependent_compositions} composition(s) depend on it</p>
            {c.retirement_reason && <p className="text-xs">{c.retirement_reason}</p>}
            {c.gaps.length > 0 && <p className="text-xs">Missing before publishing: {c.gaps.join(", ")}</p>}
            <div className="mt-1 flex gap-2">
              {!c.published && c.lifecycle_state !== "retired" && <Button size="sm" disabled={busy || c.gaps.length > 0} onClick={() => act(() => publish({ data: { capability_id: c.id } }), `Published ${c.human_ref}`)}>Publish with contract</Button>}
              {c.published && c.lifecycle_state !== "retired" && <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => use({ data: { capability_id: c.id, outcome: "success", cost: 1 } }), "Use recorded (simulated telemetry)")}>Record a use</Button>}
            </div>
          </li>
        ))}
      </ul>
      {sel.length >= 2 && (
        <Button size="sm" className="mt-2" disabled={busy} onClick={() => act(async () => {
          const r = await compose({ data: { ids: sel, title: `Composition of ${sel.length} capabilities`, scenario: "composed in the fabric" } });
          toast(`${r.human_ref}: effective authority ${r.effective_authority}`); setSel([]);
        }, "Composition recorded")}>Compose selected ({sel.length})</Button>
      )}
    </div>
  );
}

function Compositions({ data }: { data: Fabric | undefined }) {
  return (
    <div className="rounded-md border bg-panel p-3 text-sm">
      <h2 className="label-caps mb-2">Compositions (Part 7.5)</h2>
      {(data?.compositions ?? []).length === 0 && <p className="text-muted-foreground">None yet.</p>}
      <ul className="space-y-1 text-xs">
        {(data?.compositions ?? []).map((w) => (
          <li key={w.id}><span className="ident">{w.human_ref}</span> {w.title} — effective authority <span className="ident">{w.effective_authority}</span> (lowest of {w.parts.map((p) => `${p.human_ref} ${p.authority_level}`).join(", ")})</li>
        ))}
      </ul>
    </div>
  );
}

function ReuseChecks({ data }: { data: Fabric | undefined }) {
  return (
    <div className="rounded-md border bg-panel p-3 text-sm">
      <h2 className="label-caps mb-2">Recent reuse checks</h2>
      <ul className="space-y-1 text-xs">
        {(data?.reuse_checks ?? []).map((r) => (
          <li key={r.id}>{new Date(r.checked_at).toLocaleString()} · {String((r.intent_shape as { outcome?: string }).outcome ?? "")} → <span className="ident">{r.decision}</span> ({(r.results as unknown[]).length} results): {r.rationale}</li>
        ))}
      </ul>
    </div>
  );
}

function Evidence() {
  const run = useServerFn(runPhase4Evidence);
  const [r, setR] = useState<{ ledger_seq: number; selftest: { checks: Array<{ name: string; pass: boolean }> } } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-md border bg-panel p-3 text-sm">
      <h2 className="label-caps mb-2">Phase 4 exit evidence</h2>
      <Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { setR(JSON.parse(await run())); } catch (e) { toast.error(errText(e)); } finally { setBusy(false); } }}>
        {busy ? "Running…" : "Run and record"}
      </Button>
      {r && (
        <div className="mt-2" aria-live="polite">
          <p>Recorded as ledger #{r.ledger_seq}.</p>
          <ul className="text-xs">{r.selftest.checks.map((c) => <li key={c.name}>{c.pass ? "✓" : "✗"} {c.name}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
