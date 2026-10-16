/**
 * Phase 7 surface: shadow runs, discrepancy clustering, progressive exposure with armed rollback
 * and kill switch, production outcomes, incidents and value measures (Part 9).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  authorizeExposure, getPhase7Evidence, listShadowOverview, pullKillSwitch, recordIncident,
  recordProductionOutcome, recordShadowRun, recordValueMeasure, runPhase7Evidence,
} from "@/lib/shadow.functions";

export const Route = createFileRoute("/_authenticated/shadow")({
  component: ShadowPage,
  head: () => ({
    meta: [
      { title: "Shadow, exposure and production outcome — THREAD" },
      { name: "description", content: "Shadow runs, discrepancy analysis, progressive exposure with kill switch, production outcomes and value measures." },
      { property: "og:title", content: "Shadow, exposure and production outcome — THREAD" },
      { property: "og:description", content: "Shadow runs, discrepancy analysis, progressive exposure with kill switch, production outcomes and value measures." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Overview = Awaited<ReturnType<typeof listShadowOverview>>;
const CAUSES = ["data_distribution", "edge_case", "policy_gap", "model_error", "integration", "unknown"] as const;

function parseErr(e: unknown): string {
  try { return JSON.parse((e as Error).message).explanation; } catch { return (e as Error).message; }
}

function ShadowPage() {
  const load = useServerFn(listShadowOverview);
  const [ov, setOv] = useState<Overview | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [evidence, setEvidence] = useState<{ ledger_seq: number; selftest: { passed: boolean; checks: { name: string; pass: boolean; detail: string }[] } } | null>(null);
  const refresh = useCallback(async () => {
    setOv(await load());
    const ev = await getPhase7Evidence();
    if (ev) setEvidence({ ledger_seq: ev.seq, selftest: (ev.payload as { selftest: typeof ev.payload.selftest }).selftest });
  }, [load]);
  useEffect(() => { void refresh(); }, [refresh]);

  const run = async (fn: () => Promise<unknown>, ok: (r: unknown) => string) => {
    setMsg("");
    try { const r = await fn(); setMsg(ok(r)); await refresh(); } catch (e) { setMsg(parseErr(e)); }
  };

  const [capId, setCapId] = useState("");
  const [sample, setSample] = useState(100);
  const [period, setPeriod] = useState("");
  const [discCount, setDiscCount] = useState(0);
  const [cause, setCause] = useState<(typeof CAUSES)[number]>("model_error");
  const [mode, setMode] = useState<"simulated" | "live">("simulated");

  const [eaCap, setEaCap] = useState("");
  const [eaPct, setEaPct] = useState(1);
  const [eaEvidence, setEaEvidence] = useState("");
  const [eaKill, setEaKill] = useState("ks-1");
  const [ksCap, setKsCap] = useState("");
  const [ksReason, setKsReason] = useState("");

  const [poCap, setPoCap] = useState("");
  const [poPeriod, setPoPeriod] = useState("");
  const [poEvents, setPoEvents] = useState(0);
  const [inCap, setInCap] = useState("");
  const [inSev, setInSev] = useState<"minor" | "major" | "critical">("minor");
  const [inDesc, setInDesc] = useState("");

  const cap = (id: string) => ov?.capabilities.find((c) => c.id === id);

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Shadow, exposure and production outcome</h1>
        <p className="text-sm text-muted-foreground">
          A shadow capability runs against real events without controlling the outcome (Part 9). Discrepancies are clustered by cause;
          a live run above the 2% bound demotes automatically. Exposure is progressive (1 → 5 → 25 → 50 → 100%), human-authorised,
          with an armed rollback and a kill switch. Simulated evidence never promotes, authorises or measures value.
        </p>
      </header>

      {msg && <p role="status" className="rounded border bg-muted p-3 text-sm">{msg}</p>}

      <section aria-labelledby="caps" className="space-y-2">
        <h2 id="caps" className="text-lg font-medium">Capabilities</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th>Ref</th><th>Title</th><th>Authority</th><th>State</th></tr></thead>
          <tbody>
            {ov?.capabilities.map((c) => (
              <tr key={c.id} className="border-t"><td className="ident py-1">{c.human_ref}</td><td>{c.title}</td><td>{c.authority_level}</td><td>{c.lifecycle_state}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="shadow" className="space-y-3 rounded border p-4">
        <h2 id="shadow" className="text-lg font-medium">Record a shadow run</h2>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col">Capability
            <select className="rounded border bg-background p-1" value={capId} onChange={(e) => setCapId(e.target.value)}>
              <option value="">choose…</option>
              {ov?.capabilities.map((c) => <option key={c.id} value={c.id}>{c.human_ref} — {c.title}</option>)}
            </select>
          </label>
          <label className="flex flex-col">Sample size
            <input className="w-24 rounded border bg-background p-1" type="number" min={1} value={sample} onChange={(e) => setSample(Number(e.target.value))} />
          </label>
          <label className="flex flex-col">Discrepancies
            <input className="w-24 rounded border bg-background p-1" type="number" min={0} value={discCount} onChange={(e) => setDiscCount(Number(e.target.value))} />
          </label>
          <label className="flex flex-col">Cause
            <select className="rounded border bg-background p-1" value={cause} onChange={(e) => setCause(e.target.value as typeof cause)}>
              {CAUSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="flex flex-col">Period
            <input className="rounded border bg-background p-1" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-W42" />
          </label>
          <label className="flex flex-col">Mode
            <select className="rounded border bg-background p-1" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="simulated">simulated</option><option value="live">live</option>
            </select>
          </label>
          <button type="button" className="rounded bg-primary px-3 py-1 text-primary-foreground" disabled={!capId}
            onClick={() => run(() => recordShadowRun({ data: {
              capability_id: capId, sample_size: sample, period, adapter_mode: mode,
              discrepancies: Array.from({ length: discCount }, (_, i) => ({
                case_ref: `CASE-${i + 1}`, shadow_decision: "approve", actual_decision: "escalate", hypothesised_cause: cause,
              })),
            } }), (r) => {
              const x = r as { human_ref: string; discrepancy_rate: number; demoted: boolean };
              return `Recorded ${x.human_ref}: discrepancy rate ${(x.discrepancy_rate * 100).toFixed(1)}%${x.demoted ? " — above the bound, authority demoted automatically" : ""}.`;
            })}>Record run</button>
        </div>
        <ul className="space-y-1 text-sm">
          {ov?.shadowRuns.map((s) => (
            <li key={s.id} className="border-t py-1">
              <span className="ident">{s.human_ref}</span> {s.title} — rate {(((s.body as { discrepancy_rate?: number }).discrepancy_rate ?? 0) * 100).toFixed(1)}%
              {(s.body as { provenance?: { simulated?: boolean } }).provenance?.simulated ? " (simulated)" : " (live)"}
              {(s.body as { cause_clusters?: { cause: string; count: number }[] }).cause_clusters?.map((cl) => ` ${cl.cause}×${cl.count}`).join(",")}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="exposure" className="space-y-3 rounded border p-4">
        <h2 id="exposure" className="text-lg font-medium">Progressive exposure</h2>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col">Capability
            <select className="rounded border bg-background p-1" value={eaCap} onChange={(e) => setEaCap(e.target.value)}>
              <option value="">choose…</option>
              {ov?.capabilities.map((c) => <option key={c.id} value={c.id}>{c.human_ref} — {c.title}</option>)}
            </select>
          </label>
          <label className="flex flex-col">Population %
            <input className="w-20 rounded border bg-background p-1" type="number" min={1} max={100} value={eaPct} onChange={(e) => setEaPct(Number(e.target.value))} />
          </label>
          <label className="flex flex-col">Evidence bundle (live ShadowRun)
            <select className="rounded border bg-background p-1" value={eaEvidence} onChange={(e) => setEaEvidence(e.target.value)}>
              <option value="">choose…</option>
              {ov?.shadowRuns.map((s) => <option key={s.id} value={s.id}>{s.human_ref}{(s.body as { provenance?: { simulated?: boolean } }).provenance?.simulated ? " (simulated)" : " (live)"}</option>)}
            </select>
          </label>
          <label className="flex flex-col">Kill switch ref
            <input className="rounded border bg-background p-1" value={eaKill} onChange={(e) => setEaKill(e.target.value)} />
          </label>
          <button type="button" className="rounded bg-primary px-3 py-1 text-primary-foreground" disabled={!eaCap || !eaEvidence}
            onClick={() => run(() => authorizeExposure({ data: {
              capability_id: eaCap, population_pct: eaPct, evidence_bundle_ref: eaEvidence, kill_switch_ref: eaKill,
            } }), (r) => `Exposure authorised: ${(r as { human_ref: string }).human_ref}.`)}>Authorise exposure</button>
        </div>
        <ul className="space-y-1 text-sm">
          {ov?.exposures.map((e) => {
            const b = e.body as { exposure_population?: { percent: number }; authority_level_granted?: string; kill_switch_ref?: string };
            return <li key={e.id} className="border-t py-1"><span className="ident">{e.human_ref}</span> {e.title} — {b.authority_level_granted}, kill switch {b.kill_switch_ref}, state {e.lifecycle_state}</li>;
          })}
        </ul>
        <div className="flex flex-wrap items-end gap-3 border-t pt-3 text-sm">
          <label className="flex flex-col">Kill switch on
            <select className="rounded border bg-background p-1" value={ksCap} onChange={(e) => setKsCap(e.target.value)}>
              <option value="">choose…</option>
              {ov?.capabilities.map((c) => <option key={c.id} value={c.id}>{c.human_ref} — {c.title}</option>)}
            </select>
          </label>
          <label className="flex flex-col">Reason
            <input className="rounded border bg-background p-1" value={ksReason} onChange={(e) => setKsReason(e.target.value)} />
          </label>
          <button type="button" className="rounded bg-destructive px-3 py-1 text-destructive-foreground" disabled={!ksCap || !ksReason}
            onClick={() => run(() => pullKillSwitch({ data: { capability_id: ksCap, reason: ksReason } }), (r) => {
              const x = r as { human_ref: string; duration_ms: number; within_bound_ms: number };
              return `Kill switch pulled: ${x.human_ref} — stopped in ${x.duration_ms.toFixed(0)} ms (bound ${x.within_bound_ms} ms).`;
            })}>Pull kill switch</button>
        </div>
      </section>

      <section aria-labelledby="outcomes" className="space-y-3 rounded border p-4">
        <h2 id="outcomes" className="text-lg font-medium">Production outcomes and incidents</h2>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col">Capability
            <select className="rounded border bg-background p-1" value={poCap} onChange={(e) => setPoCap(e.target.value)}>
              <option value="">choose…</option>
              {ov?.capabilities.map((c) => <option key={c.id} value={c.id}>{c.human_ref} — {c.title}</option>)}
            </select>
          </label>
          <label className="flex flex-col">Period
            <input className="rounded border bg-background p-1" value={poPeriod} onChange={(e) => setPoPeriod(e.target.value)} placeholder="2026-W42" />
          </label>
          <label className="flex flex-col">Events processed
            <input className="w-24 rounded border bg-background p-1" type="number" min={0} value={poEvents} onChange={(e) => setPoEvents(Number(e.target.value))} />
          </label>
          <button type="button" className="rounded bg-primary px-3 py-1 text-primary-foreground" disabled={!poCap || !poPeriod}
            onClick={() => run(() => recordProductionOutcome({ data: { capability_id: poCap, period: poPeriod, events_processed: poEvents } }),
              (r) => `Outcome recorded: ${(r as { human_ref: string }).human_ref}.`)}>Record outcome</button>
        </div>
        <div className="flex flex-wrap items-end gap-3 border-t pt-3 text-sm">
          <label className="flex flex-col">Capability
            <select className="rounded border bg-background p-1" value={inCap} onChange={(e) => setInCap(e.target.value)}>
              <option value="">choose…</option>
              {ov?.capabilities.map((c) => <option key={c.id} value={c.id}>{c.human_ref} — {c.title}</option>)}
            </select>
          </label>
          <label className="flex flex-col">Severity
            <select className="rounded border bg-background p-1" value={inSev} onChange={(e) => setInSev(e.target.value as typeof inSev)}>
              <option value="minor">minor</option><option value="major">major</option><option value="critical">critical</option>
            </select>
          </label>
          <label className="flex flex-col">Description
            <input className="w-64 rounded border bg-background p-1" value={inDesc} onChange={(e) => setInDesc(e.target.value)} />
          </label>
          <button type="button" className="rounded bg-primary px-3 py-1 text-primary-foreground" disabled={!inCap || !inDesc}
            onClick={() => run(() => recordIncident({ data: { capability_id: inCap, severity: inSev, description: inDesc } }), (r) => {
              const x = r as { human_ref: string; demoted: boolean };
              return `Incident ${x.human_ref} recorded${x.demoted ? " — authority demoted to observe" : ""}.`;
            })}>Record incident</button>
        </div>
        <ul className="space-y-1 text-sm">
          {ov?.outcomes.map((o) => <li key={o.id} className="border-t py-1"><span className="ident">{o.human_ref}</span> {o.title}</li>)}
          {ov?.incidents.map((i) => <li key={i.id} className="border-t py-1"><span className="ident">{i.human_ref}</span> {i.title} — severity {(i.body as { severity?: string }).severity}</li>)}
        </ul>
      </section>

      <section aria-labelledby="value" className="space-y-3 rounded border p-4">
        <h2 id="value" className="text-lg font-medium">Value measures</h2>
        <ValueMeasureForm onDone={(m) => { setMsg(m); void refresh(); }} />
        <ul className="space-y-1 text-sm">
          {ov?.valueMeasures.map((v) => {
            const b = v.body as { value?: number; unit?: string; baseline?: number; delta?: number };
            return <li key={v.id} className="border-t py-1"><span className="ident">{v.human_ref}</span> {v.title} — {b.value} {b.unit} (baseline {b.baseline}, delta {b.delta})</li>;
          })}
        </ul>
      </section>

      <section aria-labelledby="evidence" className="space-y-3 rounded border p-4">
        <h2 id="evidence" className="text-lg font-medium">Phase 7 exit evidence</h2>
        <button type="button" className="rounded bg-primary px-3 py-1 text-primary-foreground"
          onClick={() => run(() => runPhase7Evidence({ data: undefined as never }), (r) => {
            const x = r as { ledger_seq: number; selftest: { passed: boolean } };
            return `Exit evidence recorded as ledger #${x.ledger_seq} — self-test ${x.selftest.passed ? "passed" : "FAILED"}.`;
          })}>Run self-test and record evidence</button>
        {evidence && (
          <div className="text-sm">
            <p>Ledger #{evidence.ledger_seq} — self-test {evidence.selftest.passed ? "passed" : "failed"} ({evidence.selftest.checks.length} checks)</p>
            <ul className="mt-2 space-y-1">
              {evidence.selftest.checks.map((c) => (
                <li key={c.name} className={c.pass ? "text-muted-foreground" : "text-destructive"}>{c.pass ? "✓" : "✗"} {c.name} — {c.detail}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}

function ValueMeasureForm({ onDone }: { onDone: (m: string) => void }) {
  const [missions, setMissions] = useState<{ id: string; human_ref: string; title: string }[]>([]);
  const [evidence, setEvidence] = useState<{ id: string; human_ref: string }[]>([]);
  const [mission, setMission] = useState("");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState(0);
  const [unit, setUnit] = useState("");
  const [baseline, setBaseline] = useState(0);
  const [delta, setDelta] = useState(0);
  const [ev, setEv] = useState("");
  useEffect(() => {
    void (async () => {
      const ov = await listShadowOverview();
      setEvidence(ov.shadowRuns.map((s) => ({ id: s.id, human_ref: s.human_ref })));
    })();
    void (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("objects").select("id,human_ref,title").eq("type", "ValueMission").eq("is_tombstone", false).limit(50);
      setMissions(data ?? []);
    })();
  }, []);
  return (
    <div className="flex flex-wrap items-end gap-3 text-sm">
      <label className="flex flex-col">Mission
        <select className="rounded border bg-background p-1" value={mission} onChange={(e) => setMission(e.target.value)}>
          <option value="">choose…</option>
          {missions.map((m) => <option key={m.id} value={m.id}>{m.human_ref} — {m.title}</option>)}
        </select>
      </label>
      <label className="flex flex-col">Title
        <input className="rounded border bg-background p-1" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="flex flex-col">Value
        <input className="w-20 rounded border bg-background p-1" type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} />
      </label>
      <label className="flex flex-col">Unit
        <input className="w-20 rounded border bg-background p-1" value={unit} onChange={(e) => setUnit(e.target.value)} />
      </label>
      <label className="flex flex-col">Baseline
        <input className="w-20 rounded border bg-background p-1" type="number" value={baseline} onChange={(e) => setBaseline(Number(e.target.value))} />
      </label>
      <label className="flex flex-col">Delta
        <input className="w-20 rounded border bg-background p-1" type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} />
      </label>
      <label className="flex flex-col">Source evidence
        <select className="rounded border bg-background p-1" value={ev} onChange={(e) => setEv(e.target.value)}>
          <option value="">none</option>
          {evidence.map((s) => <option key={s.id} value={s.id}>{s.human_ref}</option>)}
        </select>
      </label>
      <button type="button" className="rounded bg-primary px-3 py-1 text-primary-foreground" disabled={!mission || !title}
        onClick={async () => {
          try {
            const r = await recordValueMeasure({ data: { mission_id: mission, title, value, unit, baseline, delta, source_evidence: ev ? [ev] : [] } });
            onDone(`Value measure recorded: ${(r as { human_ref: string }).human_ref}.`);
          } catch (e) { onDone(parseErr(e)); }
        }}>Record value</button>
    </div>
  );
}
