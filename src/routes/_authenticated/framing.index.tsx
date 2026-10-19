/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listFramingSessions,
  startFramingSession,
  publishExtractionQuality,
  getExtractionQuality,
  runPhase2bEvidence,
  getPhase2bEvidence,
  getFramingFindings,
  runFramingSweep,
} from "@/lib/framing.functions";
import { MODALITIES, CLASS_LABELS } from "@/domain/framing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/framing/")({
  head: () => ({
    meta: [
      { title: "Framing sessions · THREAD" },
      {
        name: "description",
        content:
          "Capture consented co-creation sessions and turn what is said, drawn and decided into traced draft objects.",
      },
      { property: "og:title", content: "Framing sessions · THREAD" },
      {
        property: "og:description",
        content: "Consented capture, live classification and confirmation of business intent.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FramingHome,
});

export function errText(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  try {
    const j = JSON.parse(m);
    return `${j.code}: ${j.explanation}`;
  } catch {
    return m;
  }
}

type P = {
  name: string;
  role: "co_creator" | "builder" | "participant" | "third_party";
  decision_authority: boolean;
  authority_domain: string;
  link: "me" | "email" | "none";
  email: string;
};

export function FramingHome() {
  const list = useServerFn(listFramingSessions);
  const sessions = useQuery({ queryKey: ["framing-sessions"], queryFn: () => list() });
  return (
    <main className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <header className="thread-page-heading">
        <h1>Framing sessions</h1>
      </header>
      <section className="space-y-4">
        <StartForm />
        <div className="rounded-md border bg-panel">
          <div className="flex items-center justify-between border-b p-2">
            <h2 className="label-caps">Sessions</h2>
            <Link to="/framing/views" search={{ view: "need_web" }} className="text-xs underline">
              Open the framing views
            </Link>
          </div>
          <ul className="divide-y">
            {(sessions.data ?? []).map((s) => (
              <li key={s.id}>
                <Link
                  to="/framing/$sessionId"
                  params={{ sessionId: s.id }}
                  className="grid grid-cols-[7rem_1fr_auto] gap-2 px-3 py-2 hover:bg-accent"
                >
                  <span className="ident">{s.ref}</span>
                  <span className="truncate">{s.title}</span>
                  <span className="ident text-muted-foreground">
                    {s.state} · {s.participants} people · entry test{" "}
                    {s.entry_complete ? "complete" : "open"}
                  </span>
                </Link>
              </li>
            ))}
            {sessions.data?.length === 0 && (
              <li className="p-3 text-muted-foreground">
                No framing sessions yet. Start one above.
              </li>
            )}
          </ul>
        </div>
      </section>
      <section className="space-y-4">
        <Quality />
        <Detectors />
        <Evidence />
      </section>
    </main>
  );
}

function StartForm() {
  const start = useServerFn(startFramingSession);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [purpose, setPurpose] = useState("");
  const [mods, setMods] = useState<string[]>(["audio", "text"]);
  const [busy, setBusy] = useState(false);
  const [ps, setPs] = useState<P[]>([
    {
      name: "",
      role: "co_creator",
      decision_authority: true,
      authority_domain: "",
      link: "email",
      email: "",
    },
    {
      name: "",
      role: "builder",
      decision_authority: false,
      authority_domain: "",
      link: "me",
      email: "",
    },
  ]);
  const set = (i: number, k: Partial<P>) => setPs(ps.map((p, j) => (j === i ? { ...p, ...k } : p)));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await start({
        data: {
          purpose,
          modalities: mods as never,
          participants: ps.map((p) => ({
            ...p,
            email: p.link === "email" ? p.email : null,
            authority_domain: p.authority_domain || null,
          })),
        },
      });
      qc.invalidateQueries({ queryKey: ["framing-sessions"] });
      navigate({ to: "/framing/$sessionId", params: { sessionId: r.id } });
    } catch (err) {
      toast.error(errText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border bg-panel p-3">
      <h2 className="label-caps">Start a framing session</h2>
      <p className="text-xs text-muted-foreground">
        A working session between a Business Co-Creator and a Builder. It produces objects, not
        minutes. Capture opens only after every participant consents.
      </p>
      <div className="space-y-1">
        <Label htmlFor="purpose">Purpose</Label>
        <Textarea
          id="purpose"
          required
          minLength={3}
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Members should see their coverage without calling us"
        />
      </div>
      <fieldset className="space-y-1">
        <legend className="text-sm">What will be captured</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {MODALITIES.map((m) => (
            <label key={m} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={mods.includes(m)}
                onChange={(e) =>
                  setMods(e.target.checked ? [...mods, m] : mods.filter((x) => x !== m))
                }
              />
              {m === "audio" ? "speech" : m === "visual" ? "drawings & screens" : m}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm">People</legend>
        {ps.map((p, i) => (
          <div key={i} className="grid gap-2 rounded border p-2 sm:grid-cols-2">
            <Input
              aria-label="Name"
              placeholder="Name"
              required
              value={p.name}
              onChange={(e) => set(i, { name: e.target.value })}
            />
            <select
              aria-label="Role"
              className="h-9 rounded border bg-background px-2 text-sm"
              value={p.role}
              onChange={(e) => set(i, { role: e.target.value as P["role"] })}
            >
              <option value="co_creator">Business Co-Creator</option>
              <option value="builder">Builder</option>
              <option value="participant">Participant</option>
              <option value="third_party">Third party</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={p.decision_authority}
                onChange={(e) => set(i, { decision_authority: e.target.checked })}
              />
              Holds decision authority
            </label>
            <Input
              aria-label="Authority"
              placeholder="Authority, e.g. Claims Operations Lead"
              value={p.authority_domain}
              onChange={(e) => set(i, { authority_domain: e.target.value })}
            />
            <select
              aria-label="Account"
              className="h-9 rounded border bg-background px-2 text-sm"
              value={p.link}
              onChange={(e) => set(i, { link: e.target.value as P["link"] })}
            >
              <option value="me">This is me</option>
              <option value="email">Has a THREAD account</option>
              <option value="none">No account (consent attested)</option>
            </select>
            {p.link === "email" && (
              <Input
                aria-label="Email"
                type="email"
                placeholder="their sign-in email"
                required
                value={p.email}
                onChange={(e) => set(i, { email: e.target.value })}
              />
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setPs([
              ...ps,
              {
                name: "",
                role: "participant",
                decision_authority: false,
                authority_domain: "",
                link: "none",
                email: "",
              },
            ])
          }
        >
          Add a person
        </Button>
      </fieldset>
      <Button type="submit" disabled={busy}>
        {busy ? "Starting…" : "Start session"}
      </Button>
    </form>
  );
}

function Quality() {
  const get = useServerFn(getExtractionQuality);
  const pub = useServerFn(publishExtractionQuality);
  const q = useQuery({ queryKey: ["extraction-quality"], queryFn: () => get() });
  const [busy, setBusy] = useState(false);

  const b = q.data?.body as any;
  const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
  return (
    <div className="rounded-md border bg-panel p-3 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="label-caps">Extraction quality</h2>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await pub();
              q.refetch();
              toast.success("Published");
            } catch (e) {
              toast.error(errText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Measuring…" : "Measure and publish"}
        </Button>
      </div>
      {!b && (
        <p className="mt-2 text-muted-foreground">
          Not published yet. Measured against a labelled set, never asserted.
        </p>
      )}
      {b && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">
            Generated {new Date(q.data!.generated_at).toLocaleString()} · {b.items} items ·{" "}
            {b.model} · accuracy {pct(b.accuracy)}. {b.label_set_note}
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th>Classification</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>Support</th>
              </tr>
            </thead>
            {}
            <tbody>
              {b.by_classification.map((r: any) => (
                <tr key={r.label}>
                  <td>{CLASS_LABELS[r.label as keyof typeof CLASS_LABELS]}</td>
                  <td>{pct(r.precision)}</td>
                  <td>{pct(r.recall)}</td>
                  <td>{r.support}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th>Object type</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>Support</th>
              </tr>
            </thead>
            {}
            <tbody>
              {b.by_object_type.map((r: any) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>{pct(r.precision)}</td>
                  <td>{pct(r.recall)}</td>
                  <td>{r.support}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Detectors() {
  const get = useServerFn(getFramingFindings);
  const run = useServerFn(runFramingSweep);
  const q = useQuery({ queryKey: ["framing-findings"], queryFn: () => get() });
  return (
    <div className="rounded-md border bg-panel p-3 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="label-caps">Framing detectors · {q.data?.length ?? 0} open</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            try {
              await run();
              q.refetch();
            } catch (e) {
              toast.error(errText(e));
            }
          }}
        >
          Run detectors
        </Button>
      </div>
      <ul className="mt-2 max-h-64 space-y-1 overflow-auto">
        {(q.data ?? []).map((f) => (
          <li key={f.id} className="text-xs">
            <span className="ident text-warn">{f.detector_key}</span> · {f.severity} ·{" "}
            {(f.evidence as any)?.ref ?? ""} {(f.evidence as any)?.explanation}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Evidence() {
  const get = useServerFn(getPhase2bEvidence);
  const run = useServerFn(runPhase2bEvidence);
  const q = useQuery({ queryKey: ["phase2b-evidence"], queryFn: () => get() });
  const [busy, setBusy] = useState(false);

  const p = q.data?.payload as any;
  const yes = (b: boolean | undefined) =>
    b ? <span className="text-ok">met</span> : <span className="text-warn">not yet</span>;
  return (
    <div className="rounded-md border bg-panel p-3 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="label-caps">Phase 2B exit evidence</h2>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await run();
              q.refetch();
            } catch (e) {
              toast.error(errText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Checking…" : "Check and record"}
        </Button>
      </div>
      {p && (
        <ul className="mt-2 space-y-1 text-xs">
          <li>
            Ledger #{q.data!.seq} · {new Date(q.data!.occurred_at).toLocaleString()}
          </li>
          <li>
            Self-test ({p.selftest.checks.length} checks): {yes(p.selftest.passed)}
          </li>
          <li>
            Real session, Co-Creator and Builder, confirmed objects with full provenance:{" "}
            {yes(p.real_session.met)}{" "}
            {p.real_session.met &&
              `(${p.real_session.confirmed_objects} confirmed, ${p.real_session.provenance_coverage_pct}% covered)`}
          </li>
          <li>
            Offhand remark by a non-authority participant recorded as a suggestion, mismatch
            surfaced: {yes(p.authority_mismatch_surfaced)}
          </li>
          <li>
            Contradiction with a prior session detected live (≤ 5 s):{" "}
            {yes(p.live_cross_session_contradiction?.met)}
          </li>
          <li>
            Re-extraction with a changed extractor preserved every confirmation:{" "}
            {yes(p.re_extraction?.met)}
          </li>
          <li>
            Draft object unable to reach creation:{" "}
            {yes(
              p.selftest.checks.find((c: { name: string }) => c.name.startsWith("A draft"))?.pass,
            )}
          </li>
          <li>Entry test tracked and reported: {yes(p.entry_test_reported)}</li>
          <li>Precision and recall published: {yes(p.quality_published?.met)}</li>
          <li>
            Latency p95 (ms):{" "}
            {Object.entries(p.latency_p95_ms ?? {})
              .map(([k, v]) => `${k} ${v}`)
              .join(" · ") || "no samples yet"}
          </li>
        </ul>
      )}
    </div>
  );
}
