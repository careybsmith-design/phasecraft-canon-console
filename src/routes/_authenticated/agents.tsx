/**
 * Phase 9 surface (Part 11.12): the MCP gateway's health, quota, audit and provenance views, the agent registry,
 * K3 confirmations and the Phase 9 exit evidence. Agents act through /api/public/mcp, not through this page.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPhase9Evidence, issueConfirmation, listAgentSurface, registerAgent, revokeAgent, runPhase9Evidence } from "@/lib/agents.functions";

export const Route = createFileRoute("/_authenticated/agents")({
  component: AgentsPage,
  head: () => ({
    meta: [
      { title: "Agent gateway — THREAD" },
      { name: "description", content: "Register agents, set their authority and quotas, confirm high-consequence calls and audit every MCP call with its provenance." },
      { property: "og:title", content: "Agent gateway — THREAD" },
      { property: "og:description", content: "Register agents, set their authority and quotas, confirm high-consequence calls and audit every MCP call with its provenance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Surface = Awaited<ReturnType<typeof listAgentSurface>>;
type Ev = { passed: boolean; checks: Array<{ name: string; pass: boolean; detail: string }> };
const LEVELS = ["observe", "recommend", "act_with_confirmation", "act_bounded"] as const;
function parseErr(e: unknown) { try { return JSON.parse((e as Error).message).explanation as string; } catch { return (e as Error).message; } }

function AgentsPage() {
  const load = useServerFn(listAgentSurface);
  const reg = useServerFn(registerAgent);
  const rev = useServerFn(revokeAgent);
  const conf = useServerFn(issueConfirmation);
  const runEv = useServerFn(runPhase9Evidence);
  const getEv = useServerFn(getPhase9Evidence);
  const [s, setS] = useState<Surface | null>(null);
  const [ev, setEv] = useState<{ seq: number; payload: Ev } | null>(null);
  const [msg, setMsg] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState(""); const [mandate, setMandate] = useState(""); const [ceiling, setCeiling] = useState<(typeof LEVELS)[number]>("recommend");
  const [cpm, setCpm] = useState(60); const [cap, setCap] = useState(10);
  const [cAgent, setCAgent] = useState(""); const [cTool, setCTool] = useState("dispatch_build"); const [cArgs, setCArgs] = useState("{}"); const [cReason, setCReason] = useState("");
  const [toolFilter, setToolFilter] = useState("");

  const refresh = useCallback(async () => {
    setS(await load());
    const e = await getEv(); if (e) setEv({ seq: e.seq, payload: e.payload as unknown as Ev });
  }, [load, getEv]);
  useEffect(() => { void refresh(); }, [refresh]);
  const run = async (fn: () => Promise<string>) => { setMsg(""); try { setMsg(await fn()); await refresh(); } catch (e) { setMsg(parseErr(e)); } };
  const agentName = (id: string) => s?.agents.find((a) => a.id === id)?.name ?? id.slice(0, 8);
  const highTools = (s?.tools ?? []).filter((t) => t.high_consequence);
  const mcpUrl = typeof window === "undefined" ? "/api/public/mcp" : `${window.location.origin}/api/public/mcp`;

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Agent gateway</h1>
        <p className="text-sm text-muted-foreground">Agents act on THREAD through MCP at <span className="ident">{mcpUrl}</span> with their own token. Every call is checked against the agent's authority, quota and cost cap, and recorded with its provenance.</p>
      </header>
      {msg && <p role="status" className="rounded border p-2 text-sm">{msg}</p>}

      <section aria-labelledby="health" className="grid grid-cols-2 gap-3 rounded border p-4 sm:grid-cols-6">
        <h2 id="health" className="col-span-full text-lg font-medium">Health (last 100 calls)</h2>
        {s && ([["Calls", s.health.calls], ["Succeeded", s.health.ok], ["Refused", s.health.refused], ["Blocked", s.health.blocked], ["Errors", s.health.errors], ["p95 ms", s.health.p95_ms ?? "—"]] as const).map(([k, v]) => (
          <div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="text-xl">{v}</p></div>
        ))}
      </section>

      <section aria-labelledby="reg" className="space-y-3 rounded border p-4">
        <h2 id="reg" className="text-lg font-medium">Register an agent</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm">Name<input className="mt-1 w-full rounded border bg-background p-2" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="text-sm">Authority ceiling<select className="mt-1 w-full rounded border bg-background p-2" value={ceiling} onChange={(e) => setCeiling(e.target.value as never)}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></label>
          <label className="text-sm sm:col-span-2">Mandate (what it may do and why)<textarea className="mt-1 w-full rounded border bg-background p-2" rows={2} value={mandate} onChange={(e) => setMandate(e.target.value)} /></label>
          <label className="text-sm">Calls per minute<input type="number" className="mt-1 w-full rounded border bg-background p-2" value={cpm} onChange={(e) => setCpm(Number(e.target.value))} /></label>
          <label className="text-sm">Daily cost cap (units)<input type="number" className="mt-1 w-full rounded border bg-background p-2" value={cap} onChange={(e) => setCap(Number(e.target.value))} /></label>
        </div>
        <button type="button" className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground" onClick={() => run(async () => {
          const r = await reg({ data: { name, mandate, authority_ceiling: ceiling, calls_per_minute: cpm, cost_cap: cap } });
          setToken(r.token); setName(""); setMandate("");
          return `Registered (ledger #${r.ledger_seq}). Copy the token now; it is shown only once.`;
        })}>Register</button>
        {token && <p className="break-all rounded border border-primary p-2 text-sm">Token (shown once): <span className="ident" data-testid="agent-token">{token}</span></p>}
      </section>

      <section aria-labelledby="list" className="space-y-2 rounded border p-4">
        <h2 id="list" className="text-lg font-medium">Agents</h2>
        <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th>Name</th><th>Ceiling</th><th>Quota</th><th>Cost cap</th><th>State</th><th>Token</th><th /></tr></thead>
          <tbody>{s?.agents.map((a) => (
            <tr key={a.id} className="border-t"><td className="py-1" title={a.mandate ?? ""}>{a.name}</td><td>{a.authority_ceiling}</td><td>{(a.quota as { calls_per_minute?: number }).calls_per_minute}/min</td><td>{a.cost_cap}</td><td>{a.state}</td><td className="ident">{a.token_prefix}…</td>
              <td>{a.state === "active" && <button type="button" className="underline" onClick={() => run(async () => { const r = await rev({ data: { agent_id: a.id, reason: "revoked from the agent gateway" } }); return `Revoked (ledger #${r.ledger_seq}).`; })}>Revoke</button>}</td></tr>
          ))}</tbody></table>
      </section>

      <section aria-labelledby="k3" className="space-y-3 rounded border p-4">
        <h2 id="k3" className="text-lg font-medium">Confirm one high-consequence call</h2>
        <p className="text-sm text-muted-foreground">The token works once, for 15 minutes, for exactly this agent, tool and arguments. The agent passes it as <span className="ident">confirmation_token</span>.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm">Agent<select className="mt-1 w-full rounded border bg-background p-2" value={cAgent} onChange={(e) => setCAgent(e.target.value)}><option value="">Choose…</option>{s?.agents.filter((a) => a.state === "active").map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label className="text-sm">Tool<select className="mt-1 w-full rounded border bg-background p-2" value={cTool} onChange={(e) => setCTool(e.target.value)}>{highTools.map((t) => <option key={t.name}>{t.name}</option>)}</select></label>
          <label className="text-sm sm:col-span-2">Exact arguments (JSON)<textarea className="ident mt-1 w-full rounded border bg-background p-2 text-xs" rows={3} value={cArgs} onChange={(e) => setCArgs(e.target.value)} /></label>
          <label className="text-sm sm:col-span-2">Reason<input className="mt-1 w-full rounded border bg-background p-2" value={cReason} onChange={(e) => setCReason(e.target.value)} /></label>
        </div>
        <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => run(async () => {
          const r = await conf({ data: { agent_id: cAgent, tool: cTool, arguments_json: cArgs, reason: cReason } });
          return `Confirmation token ${r.token_id} (expires ${new Date(r.expires_at).toLocaleTimeString()}, ledger #${r.ledger_seq}).`;
        })}>Issue confirmation</button>
        {(s?.tokens.length ?? 0) > 0 && <ul className="text-xs text-muted-foreground">{s!.tokens.slice(0, 5).map((t) => <li key={t.id}><span className="ident">{t.id}</span> · {agentName(t.agent_id)} · {t.tool} · {t.consumed_at ? "used" : new Date(t.expires_at) < new Date() ? "expired" : "unused"}</li>)}</ul>}
      </section>

      <section aria-labelledby="audit" className="space-y-2 rounded border p-4">
        <h2 id="audit" className="text-lg font-medium">Call audit and provenance</h2>
        <div className="max-h-96 overflow-auto"><table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th>When</th><th>Agent</th><th>Tool</th><th>Authority</th><th>Result</th><th>ms</th><th>Ledger</th><th>Input hash</th></tr></thead>
          <tbody>{s?.calls.map((c) => (
            <tr key={c.id} className="border-t align-top"><td className="py-1">{new Date(c.started_at).toLocaleTimeString()}</td><td>{agentName(c.agent_id)}</td><td className="ident">{c.tool}</td><td>{c.authority_used}</td>
              <td title={c.error ?? ""}>{c.status}{c.refusal_code ? ` · ${c.refusal_code}` : c.error ? ` · ${c.error.split(":")[0]}` : ""}</td><td>{c.duration_ms ?? ""}</td><td>#{c.ledger_seq}</td><td className="ident">{c.input_hash.slice(0, 12)}</td></tr>
          ))}</tbody></table></div>
      </section>

      <section aria-labelledby="inj" className="space-y-2 rounded border p-4">
        <h2 id="inj" className="text-lg font-medium">Blocked injection attempts</h2>
        {s?.injection_findings.length ? <ul className="text-sm">{s.injection_findings.map((f) => {
          const e = f.evidence as { tool?: string; findings?: Array<{ rule: string; path: string }> };
          return <li key={f.id}>{new Date(f.created_at).toLocaleString()} · {e.tool} · {(e.findings ?? []).map((x) => `${x.rule} at ${x.path}`).join(", ")} · {f.state}</li>;
        })}</ul> : <p className="text-sm text-muted-foreground">None.</p>}
      </section>

      <section aria-labelledby="tools" className="space-y-2 rounded border p-4">
        <h2 id="tools" className="text-lg font-medium">Tools ({s?.tools.length ?? 0})</h2>
        <input className="w-full rounded border bg-background p-2 text-sm" placeholder="Filter tools" value={toolFilter} onChange={(e) => setToolFilter(e.target.value)} />
        <div className="max-h-96 overflow-auto"><table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th>Tool</th><th>Kernel</th><th>Authority</th><th>Effects</th><th>Status</th></tr></thead>
          <tbody>{s?.tools.filter((t) => !toolFilter || t.name.includes(toolFilter.toLowerCase())).map((t) => (
            <tr key={t.name} className="border-t align-top"><td className="ident py-1" title={t.purpose}>{t.name}</td><td>{t.kernel}</td><td>{t.authority}{t.high_consequence ? " + confirmation" : ""}</td><td>{t.side_effects}</td><td>{t.status === "live" ? "live" : `${t.status.replace("_", " ")}: ${t.pending}`}</td></tr>
          ))}</tbody></table></div>
      </section>

      <section aria-labelledby="ev" className="space-y-2 rounded border p-4">
        <h2 id="ev" className="text-lg font-medium">Phase 9 exit evidence</h2>
        <button type="button" className="rounded border px-3 py-1 text-sm" disabled={!cAgent} onClick={() => run(async () => {
          const r = await runEv({ data: { agent_id: cAgent } });
          return `${r.passed ? "Passed" : "Not passed"}: recorded as ledger #${r.ledger_seq}.`;
        })}>Check the chosen agent's run and record</button>
        {ev && <div className="text-sm"><p>Last recorded: ledger #{ev.seq} — {ev.payload.passed ? "passed" : "not passed"}</p>
          <ul>{ev.payload.checks.map((c) => <li key={c.name}>{c.pass ? "✓" : "✗"} {c.name} <span className="text-muted-foreground">— {c.detail}</span></li>)}</ul></div>}
      </section>
    </main>
  );
}
