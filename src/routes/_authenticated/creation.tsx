import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listCreation, compilePrompt, dispatchBuild, replayBuild, recordIteration, recordSkeleton, recordPhase6Evidence } from "@/lib/creation.functions";
import { PLATFORMS, PLATFORM_REGISTRY, GOVERNANCE, type Platform, type ChangeClass } from "@/domain/creation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/creation")({
  head: () => ({
    meta: [
      { title: "Creation loop · THREAD" },
      { name: "description", content: "Compile prompts from confirmed behaviour, dispatch builds to five platforms, replay them and classify every iteration." },
      { property: "og:title", content: "Creation loop · THREAD" },
      { property: "og:description", content: "Compile prompts from confirmed behaviour, dispatch builds to five platforms, replay them and classify every iteration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreationPage,
});

function errText(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  try { const j = JSON.parse(m); return `${j.code}: ${j.explanation}`; } catch { return m; }
}
type Data = Awaited<ReturnType<typeof listCreation>>;
const sel = "w-full rounded border bg-background px-2 py-1 text-sm";

function CreationPage() {
  const lc = useServerFn(listCreation);
  const q = useQuery({ queryKey: ["creation"], queryFn: () => lc() });
  if (q.error) return <p className="p-4 text-sm text-destructive">{errText(q.error)}</p>;
  if (!q.data) return <p className="p-4 text-sm text-muted-foreground">Loading the creation loop…</p>;
  return (
    <main className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <header className="thread-page-heading"><h1>Creation</h1></header>
      <section className="min-w-0 space-y-4">
        <Compile d={q.data} />
        <Prompts d={q.data} />
        <Runs d={q.data} />
      </section>
      <section className="min-w-0 space-y-4">
        <Iterate d={q.data} />
        <Platforms d={q.data} />
        <ExitEvidence />
      </section>
    </main>
  );
}

function Compile({ d }: { d: Data }) {
  const qc = useQueryClient();
  const fn = useServerFn(compilePrompt);
  const [bs, setBs] = useState<string[]>([]);
  const [con, setCon] = useState(""); const [tpl, setTpl] = useState(""); const [rc, setRc] = useState("");
  const [plat, setPlat] = useState<Platform>("codex"); const [mis, setMis] = useState("");
  const [busy, setBusy] = useState(false);
  const checks = d.reuse_checks.filter((r) => r.behavior_statement_id && bs.includes(r.behavior_statement_id));
  const templates = d.templates.filter((t) => t.lifecycle_state === "active");
  async function go() {
    setBusy(true);
    try {
      const o = await fn({ data: { behavior_ids: bs, contract_id: con, template_id: tpl, reuse_check_id: rc, target_platform: plat, mission_ref: mis || undefined, estimated_cost: 0 } });
      toast.success(`Compiled ${o.human_ref}`);
      qc.invalidateQueries({ queryKey: ["creation"] });
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-2 rounded border p-3">
      <h2 className="text-sm font-medium">Compile a creation prompt</h2>
      <p className="text-xs text-muted-foreground">Built only from typed fields of confirmed behaviour statements, an active outcome contract, an evaluated template and the active guardrails. Captured text never enters.</p>
      <fieldset className="max-h-40 overflow-auto rounded border p-2 text-sm">
        <legend className="px-1 text-xs text-muted-foreground">Confirmed behaviour statements</legend>
        {d.behaviors.length === 0 && <p className="text-xs text-muted-foreground">None yet. Confirm a behaviour statement in a framing session first.</p>}
        {d.behaviors.map((b) => (
          <label key={b.id} className="flex items-start gap-2">
            <input type="checkbox" checked={bs.includes(b.id)} onChange={(e) => setBs(e.target.checked ? [...bs, b.id] : bs.filter((x) => x !== b.id))} />
            <span><span className="ident">{b.human_ref}</span> {b.title}</span>
          </label>
        ))}
      </fieldset>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs">Outcome contract<select className={sel} value={con} onChange={(e) => setCon(e.target.value)}><option value="">Choose…</option>{d.contracts.map((c) => <option key={c.id} value={c.id}>{c.human_ref} · {c.title}</option>)}</select></label>
        <label className="text-xs">Prompt template<select className={sel} value={tpl} onChange={(e) => setTpl(e.target.value)}><option value="">Choose…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.human_ref} · {t.title} ({String((t.body as Record<string, unknown>)["evaluation_status"] ?? "no evaluation")})</option>)}</select></label>
        <label className="text-xs">Reuse check<select className={sel} value={rc} onChange={(e) => setRc(e.target.value)}><option value="">{checks.length ? "Choose…" : "Search the Fabric first"}</option>{checks.map((r) => <option key={r.id} value={r.id}>{r.decision} · {String((r.intent_shape as Record<string, unknown>)["outcome"] ?? "")}</option>)}</select></label>
        <label className="text-xs">Target platform<select className={sel} value={plat} onChange={(e) => setPlat(e.target.value as Platform)}>{PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_REGISTRY[p].label}</option>)}</select></label>
        <label className="text-xs sm:col-span-2">Mission (for its cost ceiling)<select className={sel} value={mis} onChange={(e) => setMis(e.target.value)}><option value="">None</option>{d.missions.map((m) => <option key={m.id} value={m.id}>{m.human_ref} · {m.title}</option>)}</select></label>
      </div>
      <Button size="sm" disabled={busy || !bs.length || !con || !tpl || !rc} onClick={go}>{busy ? "Compiling…" : "Compile prompt"}</Button>
    </div>
  );
}

function Prompts({ d }: { d: Data }) {
  const qc = useQueryClient();
  const fn = useServerFn(dispatchBuild);
  const [open, setOpen] = useState<string | null>(null);
  const [ceiling, setCeiling] = useState("5");
  const [picked, setPicked] = useState<Platform[]>([...PLATFORMS]);
  const [busy, setBusy] = useState<string | null>(null);
  async function go(id: string) {
    setBusy(id);
    try {
      const out = await fn({ data: { prompt_id: id, platforms: picked, cost_ceiling: Number(ceiling), estimated_cost: 0 } });
      for (const r of out) r.ok ? toast.success(`${PLATFORM_REGISTRY[r.platform].label}: dispatched`) : toast.error(`${PLATFORM_REGISTRY[r.platform].label}: ${errText(new Error(r.error ?? ""))}`);
      qc.invalidateQueries({ queryKey: ["creation"] });
    } catch (e) { toast.error(errText(e)); } finally { setBusy(null); }
  }
  return (
    <div className="space-y-2 rounded border p-3">
      <h2 className="text-sm font-medium">Prompts</h2>
      <div className="flex flex-wrap items-end gap-3 text-xs">
        <label>Per-build cost ceiling<Input className="h-8 w-24" type="number" min="0.01" step="0.01" value={ceiling} onChange={(e) => setCeiling(e.target.value)} /></label>
        {PLATFORMS.map((p) => (
          <label key={p} className="flex items-center gap-1"><input type="checkbox" checked={picked.includes(p)} onChange={(e) => setPicked(e.target.checked ? [...picked, p] : picked.filter((x) => x !== p))} />{PLATFORM_REGISTRY[p].label}</label>
        ))}
      </div>
      {d.prompts.length === 0 && <p className="text-xs text-muted-foreground">No prompts compiled yet.</p>}
      <ul className="space-y-2 text-sm">
        {d.prompts.map((p) => (
          <li key={p.id} className="rounded border p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span><span className="ident">{p.human_ref}</span> {p.title} <span className="text-muted-foreground">({p.lifecycle_state}, {p.data_classification})</span></span>
              <span className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? "Hide" : "Show prompt"}</Button>
                <Button size="sm" disabled={busy === p.id || !picked.length} onClick={() => go(p.id)}>{busy === p.id ? "Dispatching…" : `Dispatch to ${picked.length}`}</Button>
              </span>
            </div>
            {open === p.id && p.compiled && <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">{p.compiled.compiled_text}</pre>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Runs({ d }: { d: Data }) {
  const qc = useQueryClient();
  const rp = useServerFn(replayBuild);
  const sk = useServerFn(recordSkeleton);
  async function replay(id: string) {
    try {
      const r = await rp({ data: { run_id: id } });
      toast.success(`Replay ${r.human_ref}: ${r.verdict}`);
      qc.invalidateQueries({ queryKey: ["creation"] });
    } catch (e) { toast.error(errText(e)); }
  }
  async function skeleton(id: string) {
    const what = window.prompt("Which one real user process does this skeleton cover?");
    if (!what) return;
    try { const s = await sk({ data: { run_id: id, one_real_user_process: what } }); toast.success(`Recorded ${s.human_ref}`); qc.invalidateQueries({ queryKey: ["creation"] }); }
    catch (e) { toast.error(errText(e)); }
  }
  return (
    <div className="space-y-2 rounded border p-3">
      <h2 className="text-sm font-medium">Build runs</h2>
      {d.runs.length === 0 && <p className="text-xs text-muted-foreground">No builds dispatched yet.</p>}
      <ul className="space-y-2 text-sm">
        {d.runs.map((r) => {
          const b = r.run; const key = b.repro_key as Record<string, unknown>;
          const rr = b.replay_result as { verdict?: string } | null;
          return (
            <li key={r.id} className="rounded border p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span><span className="ident">{r.human_ref}</span> {PLATFORM_REGISTRY[b.platform as Platform]?.label} · {b.status}{b.adapter_mode === "simulated" && <span className="ml-1 rounded bg-muted px-1 text-xs">simulated</span>}</span>
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => replay(r.id)}>Replay</Button>
                  {b.status === "succeeded" && <Button size="sm" variant="outline" onClick={() => skeleton(r.id)}>Record skeleton</Button>}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Cost {b.cost_actual ?? "–"} of ceiling {b.cost_ceiling} · replay {b.replay_mode} · model {String(key["model_version"])} · template v{String(key["template_version"])} · guardrails {String(key["guardrail_set_version"]).slice(0, 8)}
                {b.replay_of && <> · replay of an earlier run{rr?.verdict ? `: ${rr.verdict}` : ""}</>}
                {b.failure_reason && <> · {b.failure_reason}</>}
              </p>
              {(b.artifacts as Array<{ kind: string; hash: string }>).map((a) => <p key={a.hash} className="ident text-xs">{a.kind} {a.hash.slice(0, 16)}</p>)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
function Iterate({ d }: { d: Data }) {
  const qc = useQueryClient();
  const fn = useServerFn(recordIteration);
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [cls, setCls] = useState<ChangeClass>("cosmetic");
  const [ob, setOb] = useState(""); const [res, setRes] = useState(""); const [ctr, setCtr] = useState(""); const [txt, setTxt] = useState("");
  async function go() {
    try {
      const r = await fn({ data: { from_run: from, to_run: to, declared_class: cls, diff: { added_obligations: lines(ob), changed_results: lines(res), changed_contracts: lines(ctr), text_edits: lines(txt) } } });
      if (r.scope_change_flag) toast.error(`${r.human_ref}: declared ${r.classification}, but the change adds an obligation. Flagged as a scope change.`);
      else toast.success(`${r.human_ref}: ${r.classification}. ${r.governance}`);
      qc.invalidateQueries({ queryKey: ["creation"] });
    } catch (e) { toast.error(errText(e)); }
  }
  const runOpt = d.runs.map((r) => <option key={r.id} value={r.id}>{r.human_ref} · {PLATFORM_REGISTRY[r.run.platform as Platform]?.label}</option>);
  return (
    <div className="space-y-2 rounded border p-3">
      <h2 className="text-sm font-medium">Classify an iteration</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs">From run<select className={sel} value={from} onChange={(e) => setFrom(e.target.value)}><option value="">Choose…</option>{runOpt}</select></label>
        <label className="text-xs">To run<select className={sel} value={to} onChange={(e) => setTo(e.target.value)}><option value="">Choose…</option>{runOpt}</select></label>
        <label className="text-xs sm:col-span-2">Declared class<select className={sel} value={cls} onChange={(e) => setCls(e.target.value as ChangeClass)}>{(["cosmetic", "behavioural", "scope", "architecture"] as const).map((c) => <option key={c} value={c}>{c}: {GOVERNANCE[c]}</option>)}</select></label>
      </div>
      <p className="text-xs text-muted-foreground">Describe what the change does, one item per line.</p>
      <label className="block text-xs">New obligations or outcomes<Textarea rows={2} value={ob} onChange={(e) => setOb(e.target.value)} /></label>
      <label className="block text-xs">Changed results or rules<Textarea rows={2} value={res} onChange={(e) => setRes(e.target.value)} /></label>
      <label className="block text-xs">Changed composition, dependencies or contracts<Textarea rows={2} value={ctr} onChange={(e) => setCtr(e.target.value)} /></label>
      <label className="block text-xs">Labels, wording, ordering, styling<Textarea rows={2} value={txt} onChange={(e) => setTxt(e.target.value)} /></label>
      <Button size="sm" disabled={!from || !to} onClick={go}>Record iteration</Button>
      {d.findings.length > 0 && (
        <div className="space-y-1 pt-2">
          <h3 className="text-xs font-medium">Scope changes caught</h3>
          {d.findings.map((f) => { const e = f.evidence as Record<string, unknown>; return <p key={f.id} className="text-xs text-destructive">Declared {String(e["declared"])}, detected {String(e["detected"])} · {String(e["remediation"])}</p>; })}
        </div>
      )}
    </div>
  );
}

function Platforms({ d }: { d: Data }) {
  return (
    <div className="space-y-2 rounded border p-3">
      <h2 className="text-sm font-medium">Build platforms</h2>
      <ul className="space-y-1 text-xs">
        {d.platforms.map((p) => (
          <li key={p.platform}><span className="font-medium">{p.label}</span> · {p.hosting === "vendor_saas" ? "vendor SaaS" : "self-hosted"} · cleared for {(p.cleared_classes as string[]).join(", ")} · live replay {p.live_determinism.replace("_", "-")} · captures {p.capture}</li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">All five run through the simulated adapter until platform credentials are connected.</p>
    </div>
  );
}

function ExitEvidence() {
  const fn = useServerFn(recordPhase6Evidence);
  const [r, setR] = useState<Awaited<ReturnType<typeof recordPhase6Evidence>> | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2 rounded border p-3">
      <h2 className="text-sm font-medium">Phase 6 exit check</h2>
      <Button size="sm" disabled={busy} onClick={async () => { setBusy(true); try { setR(await fn()); } catch (e) { toast.error(errText(e)); } finally { setBusy(false); } }}>{busy ? "Running…" : "Run and record"}</Button>
      {r && (
        <div className="space-y-1 text-xs">
          <p className={r.selftest.passed ? "text-primary" : "text-destructive"}>{r.selftest.passed ? "All checks passed" : "Some checks failed"} · recorded as ledger #{r.ledger_seq}</p>
          <ul>{r.selftest.checks.map((c) => <li key={c.name}>{c.pass ? "✓" : "✗"} {c.name}</li>)}</ul>
          <p className="text-muted-foreground">Live builds: pending connected platforms (simulated evidence attached).</p>
        </div>
      )}
    </div>
  );
}
