import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  listObjects,
  getRegistry,
  getObjectDetail,
  createObject,
  reviseObject,
  transitionObject,
  tombstoneObject,
  verifyLedger,
  getExitEvidence,
  runExitEvidence,
} from "@/lib/canon.functions";
import {
  getObjectEdges,
  getCanonChanges,
  proposeCanonChange,
  addCanonChallenge,
  decideCanonChange,
} from "@/lib/graph.functions";
import { LABEL_ALIASES } from "@/domain/types/envelope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/canon")({
  validateSearch: z.object({ id: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Canon console · THREAD" },
      {
        name: "description",
        content: "Record, version, tombstone and audit canon objects in THREAD.",
      },
      { property: "og:title", content: "Canon console · THREAD" },
      {
        property: "og:description",
        content: "Record, version, tombstone and audit canon objects in THREAD.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CanonConsole,
});

function errText(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  try {
    const j = JSON.parse(m);
    return `${j.code}: ${j.explanation}`;
  } catch {
    return m;
  }
}

const tierClass: Record<string, string> = {
  "1": "text-tier-1",
  "2": "text-tier-2",
  "3": "text-tier-3",
  "4": "text-tier-4",
};
const label = (t: string) => LABEL_ALIASES[t] ?? t;

function CanonConsole() {
  const { id } = Route.useSearch();
  const navigate = useNavigate({ from: "/canon" });
  const [q, setQ] = useState("");
  const [showTomb, setShowTomb] = useState(false);
  const list = useServerFn(listObjects);
  const reg = useServerFn(getRegistry);
  const objects = useQuery({
    queryKey: ["objects", q, showTomb],
    queryFn: () => list({ data: { q: q || undefined, includeTombstones: showTomb } }),
  });
  const registry = useQuery({ queryKey: ["registry"], queryFn: () => reg() });

  return (
    <main className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section aria-labelledby="record" className="space-y-4">
        <RecordForm
          types={registry.data?.types ?? []}
          onCreated={(newId) => navigate({ search: { id: newId } })}
        />
        <ExitEvidence />
        <div className="rounded-md border bg-panel">
          <div className="flex flex-wrap items-center gap-2 border-b p-2">
            <Input
              aria-label="Search canon"
              placeholder="Search title or statement"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 max-w-xs"
            />
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showTomb}
                onChange={(e) => setShowTomb(e.target.checked)}
              />{" "}
              include tombstones
            </label>
            <span className="ml-auto label-caps">{objects.data?.length ?? 0} objects</span>
          </div>
          <ul className="divide-y">
            {(objects.data ?? []).map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => navigate({ search: { id: o.id } })}
                  className={`grid w-full grid-cols-[7rem_1fr_auto] items-baseline gap-2 px-3 py-2 text-left hover:bg-accent ${o.id === id ? "bg-accent" : ""} ${o.is_tombstone ? "text-tombstone line-through" : ""}`}
                >
                  <span className="ident">{o.human_ref}</span>
                  <span className="truncate">
                    {o.title} <span className="text-muted-foreground">· {label(o.type)}</span>
                  </span>
                  <span className="ident text-muted-foreground">
                    {o.lifecycle_state} · v{o.version} ·{" "}
                    <span className={tierClass[o.risk_tier]}>T{o.risk_tier}</span>
                  </span>
                </button>
              </li>
            ))}
            {objects.data?.length === 0 && (
              <li className="p-3 text-muted-foreground">
                No canon objects yet. Record the first one above.
              </li>
            )}
          </ul>
        </div>
      </section>
      <section aria-label="Object detail">
        {id ? (
          <Detail
            id={id}
            transitions={registry.data?.transitions ?? []}
            types={registry.data?.types ?? []}
          />
        ) : (
          <LedgerPanel />
        )}
      </section>
    </main>
  );
}

function RecordForm({
  types,
  onCreated,
}: {
  types: { type: string; family: string }[];
  onCreated: (id: string) => void;
}) {
  const create = useServerFn(createObject);
  const qc = useQueryClient();
  const in90 = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
  const [f, setF] = useState({
    type: "Concept",
    title: "",
    statement: "",
    machine_description: "",
    review_date: in90,
    risk_tier: "1",
    data_classification: "internal",
    purpose: "",
    rationale: "",
  });
  const [busy, setBusy] = useState(false);
  const set =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await create({
        data: {
          type: f.type,
          title: f.title,
          statement: f.statement,
          machine_description: f.machine_description,
          body: {},
          review_date: f.review_date,
          expiration_condition: { kind: "review_date_passes" },
          retirement_path: { mode: "tombstone" },
          risk_tier: f.risk_tier as "1",
          consequence_class: "none",
          permission: { roles: [], purpose: f.purpose },
          data_classification: f.data_classification as "internal",
          rationale: f.rationale,
        },
      });
      toast.success(`${r.human_ref} recorded`);
      qc.invalidateQueries({ queryKey: ["objects"] });
      setF({ ...f, title: "", statement: "", machine_description: "", rationale: "" });
      onCreated(r.id);
    } catch (err) {
      toast.error(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-labelledby="record"
      className="space-y-3 rounded-md border bg-card p-3"
    >
      <h1 id="record" className="text-sm font-semibold">
        Record a canon object
      </h1>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="col-span-2 space-y-1">
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            value={f.type}
            onChange={set("type")}
            className="h-9 w-full rounded-md border bg-background px-2"
          >
            {types.map((t) => (
              <option key={t.type} value={t.type}>
                {t.family} · {label(t.type)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="tier">Risk tier</Label>
          <select
            id="tier"
            value={f.risk_tier}
            onChange={set("risk_tier")}
            className="h-9 w-full rounded-md border bg-background px-2"
          >
            {["1", "2", "3", "4"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cls">Classification</Label>
          <select
            id="cls"
            value={f.data_classification}
            onChange={set("data_classification")}
            className="h-9 w-full rounded-md border bg-background px-2"
          >
            {["public", "internal", "confidential", "restricted"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="title">Title</Label>
        <Input id="title" required value={f.title} onChange={set("title")} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="statement">Canonical statement</Label>
        <Textarea
          id="statement"
          required
          rows={2}
          value={f.statement}
          onChange={set("statement")}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="md">How an agent should use this</Label>
        <Textarea
          id="md"
          required
          rows={2}
          value={f.machine_description}
          onChange={set("machine_description")}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="review">Review date</Label>
          <Input
            id="review"
            type="date"
            required
            value={f.review_date}
            onChange={set("review_date")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="purpose">Permitted purpose</Label>
          <Input id="purpose" required value={f.purpose} onChange={set("purpose")} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="why">Rationale</Label>
        <Input id="why" required value={f.rationale} onChange={set("rationale")} />
      </div>
      <p className="text-xs text-muted-foreground">
        Expires when the review date passes; retires by tombstone. Every write is hash-chained into
        the ledger.
      </p>
      <Button type="submit" disabled={busy}>
        Record
      </Button>
    </form>
  );
}

function ExitEvidence() {
  const get = useServerFn(getExitEvidence);
  const run = useServerFn(runExitEvidence);
  const qc = useQueryClient();
  const ev = useQuery({ queryKey: ["exit-evidence"], queryFn: () => get() });
  const [busy, setBusy] = useState(false);
  const p = ev.data?.payload as
    { all_ok?: boolean; checks?: { check: string; ok: boolean; detail: unknown }[] } | undefined;
  return (
    <details className="rounded-md border bg-panel p-3">
      <summary className="cursor-pointer text-sm">
        Phase 1 exit evidence:{" "}
        {p ? (
          <span className={p.all_ok ? "text-ok" : "text-destructive"}>
            {p.checks?.filter((c) => c.ok).length}/{p.checks?.length} checks pass
          </span>
        ) : (
          "not yet recorded"
        )}
        {ev.data && <span className="ident text-muted-foreground"> · ledger #{ev.data.seq}</span>}
      </summary>
      <ul className="mt-2 space-y-1">
        {p?.checks?.map((c) => (
          <li key={c.check} className="grid grid-cols-[1.5rem_1fr] gap-1 text-xs">
            <span
              className={c.ok ? "text-ok" : "text-destructive"}
              aria-label={c.ok ? "pass" : "fail"}
            >
              {c.ok ? "✓" : "✗"}
            </span>
            <span>
              <span className="ident">{c.check}</span>{" "}
              <span className="text-muted-foreground">
                {typeof c.detail === "string" ? c.detail : JSON.stringify(c.detail)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <Button
        size="sm"
        variant="outline"
        className="mt-2"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await run();
            toast.success("Exit evidence re-run and recorded");
            qc.invalidateQueries();
          } catch (e) {
            toast.error(errText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Re-run and record
      </Button>
    </details>
  );
}

function LedgerPanel() {
  const verify = useServerFn(verifyLedger);
  const [r, setR] = useState<Awaited<ReturnType<typeof verifyLedger>> | null>(null);
  return (
    <div className="space-y-2 rounded-md border bg-panel p-3">
      <h2 className="text-sm font-semibold">Ledger integrity</h2>
      <p className="text-xs text-muted-foreground">
        Select an object to see its provenance, versions and ledger entries.
      </p>
      <Button size="sm" onClick={async () => setR(await verify())}>
        Verify hash chain
      </Button>
      {r && (
        <p role="status" className={`ident ${r.ok ? "text-ok" : "text-destructive"}`}>
          {r.ok ? "Chain intact" : `Break at #${r.first_bad_seq}`} · {r.entries_checked} entries ·
          head {r.head_hash.slice(0, 16)}…
        </p>
      )}
    </div>
  );
}

function Links({ id }: { id: string }) {
  const get = useServerFn(getObjectEdges);
  const q = useQuery({ queryKey: ["object-edges", id], queryFn: () => get({ data: { id } }) });
  const ref = (x: string) => q.data?.nodes.find((n) => n.id === x)?.ref ?? x.slice(0, 8);
  return (
    <div className="rounded-md border bg-panel p-3">
      <h3 className="label-caps">Connections</h3>
      {q.data && q.data.edges.length === 0 && (
        <p className="text-xs text-warn">
          No connections. An object with no edges is unreachable (Part 4.5 rule 1); link it in the
          graph.
        </p>
      )}
      <ul className="mt-1 space-y-1 text-xs">
        {q.data?.edges.map((e) => (
          <li key={e.id} className="ident">
            <Link to="/canon" search={{ id: e.from }} className="underline">
              {ref(e.from)}
            </Link>{" "}
            <span className="text-primary">{e.verb}</span>{" "}
            <Link to="/canon" search={{ id: e.to }} className="underline">
              {ref(e.to)}
            </Link>
            <span className="text-muted-foreground">
              {" "}
              · {e.source}
              {e.kind ? ` · ${e.kind}` : ""} · {e.rationale}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CanonChanges({
  objectId,
  version,
  statement,
}: {
  objectId: string;
  version: number;
  statement: string;
}) {
  const get = useServerFn(getCanonChanges);
  const propose = useServerFn(proposeCanonChange);
  const challenge = useServerFn(addCanonChallenge);
  const decide = useServerFn(decideCanonChange);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["canon-changes", objectId],
    queryFn: () => get({ data: { objectId } }),
  });
  const [f, setF] = useState({ statement, rationale: "", evidence: "", hours: 72 });
  const [arg, setArg] = useState("");
  const [why, setWhy] = useState("");
  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      setArg("");
      setWhy("");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(errText(e));
    }
  }
  const open = q.data?.find((c) => c.state === "challenge_open");
  return (
    <div className="space-y-3 rounded-md border bg-card p-3">
      <h3 className="text-sm font-semibold">Canon change</h3>
      <p className="text-xs text-muted-foreground">
        Active canon changes only through a recorded path: proposal with evidence, a challenge
        window, then a steward decision. The old version is kept.
      </p>
      {!open && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            act(
              () =>
                propose({
                  data: {
                    object_id: objectId,
                    base_version: version,
                    patch: { statement: f.statement },
                    rationale: f.rationale,
                    evidence: f.evidence.split(/[\s,]+/).filter(Boolean),
                    challenge_hours: f.hours,
                  },
                }),
              "Change proposed; challenge window open",
            );
          }}
        >
          <Label htmlFor="cc-st">Proposed statement</Label>
          <Textarea
            id="cc-st"
            rows={2}
            value={f.statement}
            onChange={(e) => setF({ ...f, statement: e.target.value })}
          />
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_7rem]">
            <div className="space-y-1">
              <Label htmlFor="cc-why">Rationale</Label>
              <Input
                id="cc-why"
                required
                value={f.rationale}
                onChange={(e) => setF({ ...f, rationale: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-ev">Evidence (references, e.g. TR-2026-0001)</Label>
              <Input
                id="cc-ev"
                required
                value={f.evidence}
                onChange={(e) => setF({ ...f, evidence: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-h">Window (hours)</Label>
              <Input
                id="cc-h"
                type="number"
                min={24}
                value={f.hours}
                onChange={(e) => setF({ ...f, hours: Number(e.target.value) })}
              />
            </div>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!f.rationale || !f.evidence || f.statement === statement}
          >
            Propose change
          </Button>
        </form>
      )}
      {q.data?.map((c) => {
        const closes = new Date(c.challenge_closes_at);
        const windowOpen = c.state === "challenge_open" && closes.getTime() > Date.now();
        return (
          <section key={c.id} className="space-y-2 rounded-md border bg-panel p-2 text-xs">
            <p>
              <span className="ident">{c.state}</span> · from v{c.base_version} · proposed{" "}
              {new Date(c.proposed_at).toLocaleString()} ·{" "}
              {c.state === "challenge_open"
                ? `challenge window ${windowOpen ? "closes" : "closed"} ${closes.toLocaleString()}`
                : `decided ${c.decided_at ? new Date(c.decided_at).toLocaleString() : ""}`}
            </p>
            <p>
              <span className="label-caps">Change</span> {JSON.stringify(c.patch)}
            </p>
            <p>
              <span className="label-caps">Rationale</span> {c.rationale}
            </p>
            <p>
              <span className="label-caps">Evidence</span>{" "}
              {c.evidence.map((e) => (
                <Link key={e.id} to="/canon" search={{ id: e.id }} className="ident underline mr-2">
                  {e.human_ref}
                </Link>
              ))}
            </p>
            <h4 className="label-caps">Challenge thread</h4>
            <ul className="space-y-1">
              {c.challenges.map((x) => (
                <li key={x.id}>
                  <span className="ident text-muted-foreground">
                    {x.origin === "challenge_agent" ? "Challenge Agent" : "Human"}:
                  </span>{" "}
                  {x.argument}
                </li>
              ))}
            </ul>
            {windowOpen && (
              <div className="flex gap-2">
                <Input
                  className="h-7"
                  aria-label="Counter-argument"
                  placeholder="Add a counter-argument"
                  value={arg}
                  onChange={(e) => setArg(e.target.value)}
                />
                <Button
                  size="sm"
                  className="h-7"
                  disabled={!arg}
                  onClick={() =>
                    act(
                      () => challenge({ data: { change_id: c.id, argument: arg } }),
                      "Challenge recorded",
                    )
                  }
                >
                  Challenge
                </Button>
              </div>
            )}
            {c.state === "challenge_open" && !windowOpen && (
              <div className="flex flex-wrap gap-2">
                <Input
                  className="h-7 max-w-sm"
                  aria-label="Decision rationale"
                  placeholder="Steward decision rationale"
                  value={why}
                  onChange={(e) => setWhy(e.target.value)}
                />
                <Button
                  size="sm"
                  className="h-7"
                  disabled={!why}
                  onClick={() =>
                    act(
                      () =>
                        decide({ data: { change_id: c.id, decision: "accept", rationale: why } }),
                      "Accepted; new version recorded",
                    )
                  }
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7"
                  disabled={!why}
                  onClick={() =>
                    act(
                      () =>
                        decide({ data: { change_id: c.id, decision: "reject", rationale: why } }),
                      "Rejected; decision recorded",
                    )
                  }
                >
                  Reject
                </Button>
              </div>
            )}
            {c.decision_rationale && (
              <p>
                <span className="label-caps">Decision</span> {c.decision_rationale}{" "}
                {c.decision_object_id && (
                  <Link to="/canon" search={{ id: c.decision_object_id }} className="underline">
                    (decision record)
                  </Link>
                )}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Detail({
  id,
  transitions,
  types,
}: {
  id: string;
  transitions: { lifecycle_family: string; from_state: string; to_state: string }[];
  types: { type: string; lifecycle_family: string; family?: string }[];
}) {
  const get = useServerFn(getObjectDetail);
  const revise = useServerFn(reviseObject);
  const transition = useServerFn(transitionObject);
  const tomb = useServerFn(tombstoneObject);
  const qc = useQueryClient();
  const d = useQuery({ queryKey: ["object", id], queryFn: () => get({ data: { id } }) });
  const [statement, setStatement] = useState<string | null>(null);
  const [why, setWhy] = useState("");
  const [to, setTo] = useState("");

  if (d.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!d.data) return <p className="text-muted-foreground">Not visible under your permissions.</p>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o = d.data.object as any;
  const fam = types.find((t) => t.type === o.type)?.lifecycle_family;
  const next = transitions
    .filter((t) => t.lifecycle_family === fam && t.from_state === o.lifecycle_state)
    .map((t) => t.to_state);
  // P15: active Canon-family objects change only through the canon change path.
  const activeCanon =
    types.find((t) => t.type === o.type)?.family === "Canon" && o.lifecycle_state !== "draft";

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      setWhy("");
      setStatement(null);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(errText(e));
    }
  }

  return (
    <article className="space-y-3">
      <header className="rounded-md border bg-card p-3">
        <p className="ident text-muted-foreground">
          {o.human_ref} · {label(o.type)}
          {o.is_tombstone && " · TOMBSTONE"}
        </p>
        <h2 className="text-base font-semibold">{o.title}</h2>
        <p className="mt-1">{o.statement}</p>
        <p className="mt-1 text-xs text-muted-foreground">{o.machine_description}</p>
        {/* Provenance strip (Part 18.2) */}
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
          {[
            ["State", o.lifecycle_state],
            ["Version", `v${o.version}`],
            ["Risk tier", `T${o.risk_tier}`],
            ["Authority", o.authority_level],
            ["Classification", o.data_classification],
            ["Review", o.review_date],
            ["Expires when", o.expiration_condition?.kind],
            ["Retires by", o.retirement_path?.mode],
            ["Created by", `${o.created_by?.kind}:${String(o.created_by?.id).slice(0, 8)}`],
            ["Purpose", o.permission?.purpose],
            ["Content hash", String(o.content_hash).slice(0, 12) + "…"],
            ["Chain", String(o.provenance_chain_id).slice(0, 8)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="label-caps">{k}</dt>
              <dd className="ident">{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
        {o.is_tombstone && (
          <p className="mt-2 text-xs text-muted-foreground">Retired: {o.retirement_reason}</p>
        )}
      </header>

      {!o.is_tombstone && (
        <div className="space-y-2 rounded-md border bg-card p-3">
          <Label htmlFor="why2">Rationale for the change</Label>
          <Input
            id="why2"
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="Required for every change"
          />
          {!activeCanon && (
            <Textarea
              aria-label="Revised statement"
              rows={2}
              value={statement ?? o.statement}
              onChange={(e) => setStatement(e.target.value)}
            />
          )}
          <div className="flex flex-wrap gap-2">
            {!activeCanon && (
              <Button
                size="sm"
                disabled={!why || statement === null}
                onClick={() =>
                  act(
                    () =>
                      revise({
                        data: {
                          id,
                          expected_version: o.version,
                          patch: { statement: statement ?? o.statement },
                          rationale: why,
                        },
                      }),
                    "New version recorded",
                  )
                }
              >
                Revise statement
              </Button>
            )}
            <select
              aria-label="Next state"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">Move to…</option>
              {next.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <Button
              size="sm"
              variant="secondary"
              disabled={!why || !to}
              onClick={() =>
                act(
                  () =>
                    transition({
                      data: { id, expected_version: o.version, to_state: to, rationale: why },
                    }),
                  `Moved to ${to}`,
                )
              }
            >
              Transition
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={!why}
              onClick={() =>
                act(
                  () => tomb({ data: { id, expected_version: o.version, reason: why } }),
                  "Tombstoned",
                )
              }
            >
              Tombstone
            </Button>
            <Link
              to="/graph"
              search={{ view: "focus", root: id }}
              className="self-center text-xs underline"
            >
              Link and explore in the graph
            </Link>
          </div>
        </div>
      )}
      {activeCanon && !o.is_tombstone && (
        <CanonChanges objectId={id} version={o.version} statement={o.statement} />
      )}
      <Links id={id} />

      <div className="rounded-md border bg-panel p-3">
        <h3 className="label-caps">Versions</h3>
        <ol className="mt-1 space-y-1 text-xs">
          {d.data.versions.map(
            (v: { version: number; lifecycle_state: string; statement: string }) => (
              <li key={v.version} className="grid grid-cols-[2.5rem_7rem_1fr] gap-2">
                <span className="ident">v{v.version}</span>
                <span className="ident text-muted-foreground">{v.lifecycle_state}</span>
                <span className="truncate">{v.statement}</span>
              </li>
            ),
          )}
        </ol>
      </div>
      <div className="rounded-md border bg-panel p-3">
        <h3 className="label-caps">Ledger</h3>
        <ol className="mt-1 space-y-1 text-xs">
          {d.data.ledger.map(
            (l: {
              seq: number;
              action: string;
              object_version: number | null;
              hash: string;
              prev_hash: string;
            }) => (
              <li key={l.seq} className="grid grid-cols-[3rem_9rem_2.5rem_1fr] gap-2">
                <span className="ident">#{l.seq}</span>
                <span className="ident">{l.action}</span>
                <span className="ident">v{l.object_version}</span>
                <span className="ident truncate text-muted-foreground" title={l.hash}>
                  {l.hash.slice(0, 20)}… ← {l.prev_hash.slice(0, 8)}
                </span>
              </li>
            ),
          )}
        </ol>
      </div>
    </article>
  );
}
