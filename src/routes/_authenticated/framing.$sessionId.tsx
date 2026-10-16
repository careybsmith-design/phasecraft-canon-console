import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getFramingSession,
  recordConsent,
  withdrawConsent,
  openCapture,
  captureUtterance,
  captureImage,
  classifyStatement,
  confirmObject,
  rejectObject,
  deferObject,
  resolveFinding,
  updateEntryTest,
  reExtractSession,
  closeFramingSession,
} from "@/lib/framing.functions";
import {
  CLASSES,
  CLASS_LABELS,
  MODALITIES,
  type Participant,
  type StatementClass,
} from "@/domain/framing";
import { TIER_ROUTES, type ContentTier } from "@/domain/content-tier";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errText } from "./framing.index";

export const Route = createFileRoute("/_authenticated/framing/$sessionId")({
  head: () => ({
    meta: [
      { title: "Live framing session · THREAD" },
      {
        name: "description",
        content:
          "Live transcript, extraction, contradictions, prior objects and confirmation for one framing session.",
      },
      { property: "og:title", content: "Live framing session · THREAD" },
      {
        property: "og:description",
        content: "See what THREAD is capturing and correct it while the conversation is alive.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SessionSurface,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
type Queued = {
  client_id: string;
  speaker_id: string;
  text: string;
  mode: string;
  t_offset_ms: number;
};

const MODES: Array<[string, string]> = [
  ["speech", "Speech (simulated transcription)"],
  ["typed_notes", "Typed note"],
  ["chat", "Chat"],
  ["prototype_interaction", "Prototype interaction"],
  ["brought_in_document", "Pasted document"],
  ["third_party_recording", "Third-party material"],
];

function SessionSurface() {
  const { sessionId } = Route.useParams();
  const get = useServerFn(getFramingSession);
  const qc = useQueryClient();
  const key = ["framing-session", sessionId];
  const q = useQuery({ queryKey: key, queryFn: () => get({ data: { id: sessionId } }) });
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: key }), [qc, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live push (8A.7.4): findings and timeline events stream in for every participant
  useEffect(() => {
    const ch = supabase
      .channel(`framing-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "framing_live_findings",
          filter: `session_id=eq.${sessionId}`,
        },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_events",
          filter: `session_id=eq.${sessionId}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [sessionId, refresh]);

  if (q.isLoading) return <p className="p-4 text-muted-foreground">Loading session…</p>;
  if (q.error) return <p className="p-4 text-destructive">{errText(q.error)}</p>;
  if (!q.data)
    return (
      <p className="p-4">
        Session not found.{" "}
        <Link to="/framing" className="underline">
          Back
        </Link>
      </p>
    );
  const d = q.data;
  const s = d.session as Row;
  const ps = (s.body.participants ?? []) as Participant[];
  return (
    <main className="space-y-3 p-4">
      <Header d={d} onChange={refresh} />
      {s.lifecycle_state === "planned" && <ConsentPanel d={d} onChange={refresh} />}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,0.9fr)]">
        <section className="space-y-3" aria-label="Capture and transcript">
          {s.lifecycle_state === "capturing" && (
            <Capture
              sessionId={sessionId}
              participants={ps}
              openedAt={s.body.opened_at}
              onDone={refresh}
            />
          )}
          <Transcript events={d.events} participants={ps} />
          <PrototypePane events={d.events} objects={d.objects} />
        </section>
        <section className="space-y-3" aria-label="Live extraction">
          <Extraction d={d} onChange={refresh} />
        </section>
        <section className="space-y-3" aria-label="Prompts and readiness">
          <EntryTest d={d} onChange={refresh} />
          <Prompts d={d} onChange={refresh} />
          <MaterialRail d={d} />
        </section>
      </div>
    </main>
  );
}

function Header({ d, onChange }: { d: Row; onChange: () => void }) {
  const s = d.session;
  const reX = useServerFn(reExtractSession);
  const close = useServerFn(closeFramingSession);
  const [busy, setBusy] = useState<string | null>(null);
  const active = d.consents.filter((c: Row) => !c.withdrawn_at);
  const tier = (s.body.content_tier ?? "A") as ContentTier;
  const lat = d.latency as Record<string, { p95: number | null; n: number; budget: number }>;
  return (
    <header className="space-y-2 rounded-md border bg-panel p-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <Link to="/framing" className="text-xs underline">
          Sessions
        </Link>
        <h1 className="text-lg">
          <span className="ident text-primary">{s.human_ref}</span> {s.title}
        </h1>
        <span className="ident text-muted-foreground">
          {s.lifecycle_state} · extraction revision {s.body.extraction_revision} (
          {s.body.extractor_version})
        </span>
        <Link
          to="/framing/views"
          search={{ view: "session_constellation", session: s.id }}
          className="text-xs underline"
        >
          Session Constellation
        </Link>
      </div>
      <div role="status" aria-label="Consent and tier" className="flex flex-wrap gap-4 text-xs">
        <span>
          Consent: {active.length} active record(s) for {(s.body.modalities ?? []).join(", ")}
        </span>
        <span>
          Content tier <strong className={tier === "A" ? "text-ok" : "text-warn"}>{tier}</strong> —{" "}
          {TIER_ROUTES[tier]}
        </span>
        <span>Speech capture uses the simulated transcription adapter</span>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {Object.entries(lat).map(([k, v]) => (
          <span key={k}>
            {k.replace(/_/g, " ")} p95{" "}
            <span
              className={v.p95 != null && v.p95 > v.budget ? "text-destructive" : "text-foreground"}
            >
              {v.p95 ?? "—"}
            </span>
            /{v.budget} ms ({v.n})
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!!busy || s.lifecycle_state === "planned"}
          onClick={async () => {
            setBusy("rx");
            try {
              const r = await reX({
                data: {
                  session_id: s.id,
                  extractor_version: s.body.extractor_version === "xv1" ? "xv2" : "xv1",
                },
              });
              toast.success(
                `Revision ${r.revision}: ${r.statements} statements, ${r.preserved_confirmations} confirmations preserved, ${r.superseded_drafts} drafts superseded`,
              );
              onChange();
            } catch (e) {
              toast.error(errText(e));
            } finally {
              setBusy(null);
            }
          }}
        >
          {busy === "rx"
            ? "Re-extracting…"
            : `Re-extract with ${s.body.extractor_version === "xv1" ? "xv2" : "xv1"}`}
        </Button>
        {s.lifecycle_state === "capturing" && (
          <Button
            size="sm"
            disabled={!!busy}
            onClick={async () => {
              setBusy("close");
              try {
                const r = await close({ data: { session_id: s.id } });
                toast.success(
                  r.entry_test_result.completed
                    ? "Closed. Entry test complete."
                    : `Closed. Entry test incomplete, so the session yields ${r.open_question}.`,
                );
                onChange();
              } catch (e) {
                toast.error(errText(e));
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === "close" ? "Closing…" : "Close session"}
          </Button>
        )}
      </div>
    </header>
  );
}

function ConsentPanel({ d, onChange }: { d: Row; onChange: () => void }) {
  const rec = useServerFn(recordConsent);
  const wd = useServerFn(withdrawConsent);
  const open = useServerFn(openCapture);
  const s = d.session;
  const ps = s.body.participants as Participant[];
  const mods = (s.body.modalities ?? []) as string[];
  const [att, setAtt] = useState<Record<string, string>>({});
  const has = (pid: string, m: string) =>
    d.consents.some(
      (c: Row) => c.participant_id === pid && !c.withdrawn_at && c.modalities.includes(m),
    );
  return (
    <section className="rounded-md border bg-panel p-3 text-sm" aria-label="Consent">
      <h2 className="label-caps">Consent before capture</h2>
      <p className="text-xs text-muted-foreground">
        Capture cannot open until every person consents to every kind of capture. People with an
        account consent for themselves.
      </p>
      <ul className="mt-2 space-y-2">
        {ps.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 rounded border p-2">
            <span className="min-w-40">
              {p.name}{" "}
              <span className="text-xs text-muted-foreground">
                ({p.role.replace("_", " ")}
                {p.decision_authority ? ", decision authority" : ""})
              </span>
            </span>
            <span className="text-xs">
              {mods.map((m) => (
                <span key={m} className={`mr-2 ${has(p.id, m) ? "text-ok" : "text-warn"}`}>
                  {m} {has(p.id, m) ? "✓" : "—"}
                </span>
              ))}
            </span>
            {(p.user_id === d.me || !p.user_id) && !mods.every((m) => has(p.id, m)) && (
              <>
                {!p.user_id && (
                  <Input
                    className="h-8 max-w-xs"
                    placeholder="How they consented (e.g. verbally, at start)"
                    value={att[p.id] ?? ""}
                    onChange={(e) => setAtt({ ...att, [p.id]: e.target.value })}
                  />
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await rec({
                        data: {
                          session_id: s.id,
                          participant_id: p.id,
                          modalities: mods as never,
                          attestation: att[p.id] || undefined,
                        },
                      });
                      onChange();
                    } catch (e) {
                      toast.error(errText(e));
                    }
                  }}
                >
                  {p.user_id === d.me ? "I consent" : "Record consent"}
                </Button>
              </>
            )}
            {p.user_id && p.user_id !== d.me && !mods.every((m) => has(p.id, m)) && (
              <span className="text-xs text-muted-foreground">
                Waiting for {p.name} to consent from their account
              </span>
            )}
            {d.consents
              .filter(
                (c: Row) =>
                  c.participant_id === p.id &&
                  !c.withdrawn_at &&
                  (p.user_id === d.me || !p.user_id),
              )
              .map((c: Row) => (
                <button
                  key={c.id}
                  type="button"
                  className="text-xs underline"
                  onClick={async () => {
                    await wd({ data: { session_id: s.id, consent_id: c.id } });
                    onChange();
                  }}
                >
                  withdraw
                </button>
              ))}
          </li>
        ))}
      </ul>
      <Button
        className="mt-2"
        size="sm"
        onClick={async () => {
          try {
            await open({ data: { session_id: s.id } });
            onChange();
          } catch (e) {
            toast.error(errText(e));
          }
        }}
      >
        Open capture
      </Button>
    </section>
  );
}

function Capture({
  sessionId,
  participants,
  openedAt,
  onDone,
}: {
  sessionId: string;
  participants: Participant[];
  openedAt: string | null;
  onDone: () => void;
}) {
  const send = useServerFn(captureUtterance);
  const sendImg = useServerFn(captureImage);
  const storeKey = `thread.capture.${sessionId}`;
  const [speaker, setSpeaker] = useState(participants[0]?.id ?? "");
  const [mode, setMode] = useState("speech");
  const [text, setText] = useState("");
  const [queue, setQueue] = useState<Queued[]>([]);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const flushing = useRef(false);
  const offset = () => Math.max(0, Date.now() - (openedAt ? Date.parse(openedAt) : Date.now()));
  useEffect(() => {
    try {
      setQueue(JSON.parse(localStorage.getItem(storeKey) ?? "[]"));
    } catch {
      setQueue([]);
    }
  }, [storeKey]);
  const persist = (qq: Queued[]) => {
    setQueue(qq);
    localStorage.setItem(storeKey, JSON.stringify(qq));
  };

  // Zero-loss capture (8A.13): buffered locally, streamed, retried until the server has it
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    setBusy(true);
    try {
      let qq: Queued[] = JSON.parse(localStorage.getItem(storeKey) ?? "[]");
      while (qq.length) {
        const item = qq[0]!;
        try {
          const r = await send({ data: item as never });
          if (r.blocked)
            toast.error(
              `Blocked before any model call: ${(r as Row).reasons?.join("; ")}. Nothing was stored.`,
            );
          else if (!r.duplicate)
            setLast(
              `${r.statements} statement(s) in ${(r as Row).latency_ms} ms · ${(r as Row).route}${(r as Row).model_error ? ` (model fallback: ${(r as Row).model_error})` : ""}`,
            );
          qq = qq.slice(1);
          persist(qq);
          onDone();
        } catch (e) {
          const m = errText(e);
          if (/CAPTURE_NOT_OPEN|NOT_FOUND|AUTHORITY/.test(m)) {
            qq = qq.slice(1);
            persist(qq);
            toast.error(m);
            continue;
          }
          toast.error(`Kept on this device, will retry: ${m}`);
          break;
        }
      }
    } finally {
      flushing.current = false;
      setBusy(false);
    }
  }, [send, storeKey, onDone]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const on = () => flush();
    window.addEventListener("online", on);
    const t = setInterval(on, 15000);
    return () => {
      window.removeEventListener("online", on);
      clearInterval(t);
    };
  }, [flush]);

  return (
    <form
      className="space-y-2 rounded-md border bg-panel p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        persist([
          ...queue,
          {
            client_id: crypto.randomUUID(),
            speaker_id: speaker,
            text: text.trim(),
            mode,
            t_offset_ms: offset(),
          },
        ]);
        setText("");
        void flush();
      }}
    >
      <h2 className="label-caps">Capture</h2>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Speaker"
          className="h-8 rounded border bg-background px-2 text-sm"
          value={speaker}
          onChange={(e) => setSpeaker(e.target.value)}
        >
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.decision_authority ? " ★" : ""}
            </option>
          ))}
        </select>
        <select
          aria-label="Kind"
          className="h-8 rounded border bg-background px-2 text-sm"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          {MODES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <Textarea
        aria-label="What was said or written"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type what the speaker said…"
        rows={3}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
            (e.currentTarget.form as HTMLFormElement).requestSubmit();
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={busy && !text}>
          Capture
        </Button>
        <label className="text-xs underline">
          Add a drawing or screenshot
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (f.size > 5_000_000) {
                toast.error("Images up to 5 MB");
                return;
              }
              const url = await new Promise<string>((res) => {
                const r = new FileReader();
                r.onload = () => res(String(r.result));
                r.readAsDataURL(f);
              });
              setBusy(true);
              try {
                const r = await sendImg({
                  data: {
                    session_id: sessionId,
                    speaker_id: speaker,
                    kind: "whiteboard",
                    t_offset_ms: offset(),
                    data_url: url,
                    name: f.name,
                  },
                });
                toast.success(`${r.statements} statement(s) from the drawing`);
                onDone();
              } catch (err) {
                toast.error(errText(err));
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {queue.length > 0 && (
          <span className="text-xs text-warn">{queue.length} waiting to send</span>
        )}
        {last && <span className="text-xs text-muted-foreground">{last}</span>}
      </div>
    </form>
  );
}

function Transcript({ events, participants }: { events: Row[]; participants: Participant[] }) {
  const byId = new Map(participants.map((p) => [p.id, p]));
  const fmt = (ms: number) =>
    `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
  return (
    <section className="rounded-md border bg-panel p-3" aria-label="Live transcript">
      <h2 className="label-caps">Timeline</h2>
      <ol className="mt-2 max-h-[28rem] space-y-1 overflow-auto text-sm" aria-live="polite">
        {events.map((e) => {
          const p = byId.get(e.payload?.speaker);
          if (e.kind === "segment")
            return (
              <li key={e.id}>
                <span className="ident text-muted-foreground">{fmt(e.t_offset_ms)}</span>{" "}
                <strong>{e.payload.speaker_name}</strong>
                {p?.decision_authority ? (
                  <span className="text-primary" title="holds decision authority">
                    {" "}
                    ★
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {" "}
                  {e.payload.mode ?? "speech"}
                  {e.payload.simulated ? " (sim)" : ""}
                </span>
                : {e.payload.text}
              </li>
            );
          return (
            <li key={e.id} className="text-xs text-muted-foreground">
              {e.kind}
              {e.kind === "capture.blocked"
                ? ` — ${e.payload.speaker}: content withheld (${(e.payload.reasons ?? []).join("; ")})`
                : e.payload?.participant
                  ? ` — ${e.payload.participant}`
                  : ""}
            </li>
          );
        })}
        {!events.length && <li className="text-muted-foreground">Nothing captured yet.</li>}
      </ol>
    </section>
  );
}

function PrototypePane({ events, objects }: { events: Row[]; objects: Row[] }) {
  const logs = events.filter(
    (e) => e.kind === "segment" && e.payload.mode === "prototype_interaction",
  );
  const current = [...objects]
    .reverse()
    .find((o) => o.type === "BehaviorStatement" && !o.is_tombstone);
  return (
    <section className="rounded-md border bg-panel p-3 text-sm" aria-label="Prototype">
      <h2 className="label-caps">Prototype</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Under discussion:{" "}
        {current ? (
          <span className="text-primary">
            {current.human_ref} {current.title}
          </span>
        ) : (
          "no behaviour statement yet"
        )}
      </p>
      <ul className="mt-1 space-y-1 text-xs">
        {logs.map((l) => (
          <li key={l.id}>
            {l.payload.speaker_name} did: {l.payload.text}
          </li>
        ))}
      </ul>
      {!logs.length && (
        <p className="text-xs text-muted-foreground">
          Log what the Co-Creator does in the working skeleton with the “Prototype interaction”
          kind.
        </p>
      )}
    </section>
  );
}

function Extraction({ d, onChange }: { d: Row; onChange: () => void }) {
  const xs = d.objects.filter(
    (o: Row) =>
      o.type === "ExtractedStatement" && !o.is_tombstone && o.lifecycle_state !== "superseded",
  );
  const typed = new Map<string, Row>(d.objects.map((o: Row) => [o.id, o]));
  const [show, setShow] = useState<"all" | "open">("all");
  const list = show === "open" ? xs.filter((x: Row) => x.lifecycle_state === "draft") : xs;
  return (
    <section className="rounded-md border bg-panel p-3" aria-label="Extracted statements">
      <div className="flex items-center justify-between">
        <h2 className="label-caps">Live extraction · {xs.length}</h2>
        <select
          aria-label="Filter"
          className="h-7 rounded border bg-background px-1 text-xs"
          value={show}
          onChange={(e) => setShow(e.target.value as "all" | "open")}
        >
          <option value="all">all</option>
          <option value="open">drafts only</option>
        </select>
      </div>
      <ul className="mt-2 max-h-[48rem] space-y-2 overflow-auto">
        {[...list].reverse().map((x: Row) => (
          <StatementCard
            key={x.id}
            x={x}
            obj={x.body.resolved_object_ref ? typed.get(x.body.resolved_object_ref) : null}
            d={d}
            onChange={onChange}
          />
        ))}
        {!xs.length && (
          <li className="text-sm text-muted-foreground">
            Objects appear here as they are articulated.
          </li>
        )}
      </ul>
    </section>
  );
}

function StatementCard({
  x,
  obj,
  d,
  onChange,
}: {
  x: Row;
  obj: Row | null;
  d: Row;
  onChange: () => void;
}) {
  const cls = useServerFn(classifyStatement);
  const conf = useServerFn(confirmObject);
  const rej = useServerFn(rejectObject);
  const def = useServerFn(deferObject);
  const [mode, setMode] = useState<null | "edit" | "defer" | "reject">(null);
  const [title, setTitle] = useState(x.title);
  const [stmt, setStmt] = useState(x.statement);
  const [reason, setReason] = useState("");
  const [due, setDue] = useState(new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10));
  const ps = d.session.body.participants as Participant[];
  const [owner, setOwner] = useState(ps.find((p) => p.decision_authority)?.id ?? ps[0]?.id);
  const draft = x.lifecycle_state === "draft";
  const act = async (f: () => Promise<unknown>) => {
    try {
      await f();
      setMode(null);
      onChange();
    } catch (e) {
      toast.error(errText(e));
    }
  };
  const sp = x.body.provenance_spans?.[0];
  return (
    <li className={`rounded border p-2 text-sm ${draft ? "border-dashed" : ""}`}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="ident">{x.human_ref}</span>
        {draft ? (
          <span className="rounded bg-muted px-1 text-xs">DRAFT</span>
        ) : (
          <span
            className={`text-xs ${x.lifecycle_state === "confirmed" ? "text-ok" : "text-muted-foreground"}`}
          >
            {x.lifecycle_state}
          </span>
        )}
        {x.body.material && <span className="text-xs text-warn">material</span>}
        <span className="text-xs text-muted-foreground">
          {x.body.speaker_name} · {sp?.kind}{" "}
          {Array.isArray(sp?.start) ? "" : `${sp?.start}–${sp?.end}`} · {x.body.model} ·{" "}
          {Math.round((x.body.confidence ?? 0) * 100)}%
          {x.body.provenance?.simulated ? " · simulated" : ""}
        </span>
      </div>
      <p className="mt-1">“{x.statement}”</p>
      {obj && (
        <p className="text-xs text-muted-foreground">
          → <span className="ident">{obj.human_ref}</span> {obj.type}
          {x.body.kind && obj.type === "BehaviorStatement" ? ` (${x.body.kind})` : ""} ·{" "}
          {obj.lifecycle_state}
        </p>
      )}
      {x.body.authority_mismatch && (
        <p className="text-xs text-warn">{x.body.authority_mismatch}</p>
      )}
      {x.body.supersedes_candidate && (
        <p className="text-xs text-muted-foreground">
          Proposed successor to a confirmed statement (the confirmation stands).
        </p>
      )}
      {x.body.deferral && (
        <p className="text-xs text-muted-foreground">
          Deferred to {x.body.deferral.owner_name} by {x.body.deferral.due}:{" "}
          {x.body.deferral.reason}
        </p>
      )}
      <div role="group" aria-label="Classification" className="mt-1 flex flex-wrap gap-1">
        {CLASSES.map((c) => (
          <button
            key={c}
            type="button"
            disabled={!draft}
            aria-pressed={x.body.classification === c}
            className={`rounded border px-1.5 text-xs ${x.body.classification === c ? "border-primary text-primary" : "text-muted-foreground"} disabled:opacity-60`}
            onClick={() =>
              act(() => cls({ data: { statement_id: x.id, classification: c as StatementClass } }))
            }
          >
            {CLASS_LABELS[c]}
          </button>
        ))}
      </div>
      {draft && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() =>
              mode === "edit"
                ? act(() => conf({ data: { statement_id: x.id, title, statement: stmt } }))
                : act(() => conf({ data: { statement_id: x.id } }))
            }
          >
            Confirm
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMode(mode === "edit" ? null : "edit")}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMode(mode === "reject" ? null : "reject")}
          >
            Reject
          </Button>
          {x.body.material && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMode(mode === "defer" ? null : "defer")}
            >
              Defer
            </Button>
          )}
        </div>
      )}
      {mode === "edit" && (
        <div className="mt-2 space-y-1">
          <Input aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea aria-label="Statement" value={stmt} onChange={(e) => setStmt(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Press Confirm to record the edited version.
          </p>
        </div>
      )}
      {mode === "reject" && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            act(() => rej({ data: { statement_id: x.id, reason } }));
          }}
        >
          <Input
            aria-label="Why"
            required
            placeholder="Why"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button size="sm" type="submit">
            Reject
          </Button>
        </form>
      )}
      {mode === "defer" && (
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            act(() =>
              def({ data: { statement_id: x.id, owner_participant_id: owner!, due, reason } }),
            );
          }}
        >
          <select
            aria-label="Owner"
            className="h-8 rounded border bg-background px-2 text-sm"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          >
            {ps.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Input
            aria-label="Due"
            type="date"
            className="w-40"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
          <Input
            aria-label="Reason"
            required
            placeholder="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="flex-1"
          />
          <Button size="sm" type="submit">
            Defer
          </Button>
        </form>
      )}
    </li>
  );
}

function EntryTest({ d, onChange }: { d: Row; onChange: () => void }) {
  const upd = useServerFn(updateEntryTest);
  const e = d.entry_test;
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState({
    person: e.person ?? "",
    outcome: e.outcome ?? "",
    ability: e.ability ?? "",
    evidence: e.evidence ?? "",
  });
  useEffect(() => {
    if (!edit)
      setV({
        person: e.person ?? "",
        outcome: e.outcome ?? "",
        ability: e.ability ?? "",
        evidence: e.evidence ?? "",
      });
  }, [e.person, e.outcome, e.ability, e.evidence, edit]);
  const parts = [
    ["person", "For"],
    ["outcome", "we will improve"],
    ["ability", "by enabling"],
    ["evidence", "proven by"],
  ] as const;
  const done = parts.filter(([k]) => e[k]).length;
  return (
    <section className="rounded-md border bg-panel p-3 text-sm" aria-label="Entry test">
      <div className="flex items-center justify-between">
        <h2 className="label-caps">Entry test · {done}/4</h2>
        <button type="button" className="text-xs underline" onClick={() => setEdit(!edit)}>
          {edit ? "cancel" : "edit"}
        </button>
      </div>
      <p className={`mt-1 ${e.complete ? "text-ok" : ""}`}>{e.sentence}</p>
      {!e.complete && (
        <p className="text-xs text-muted-foreground">
          Until all four parts are filled, closing yields an open question, not a mission.
        </p>
      )}
      {edit && (
        <form
          className="mt-2 space-y-1"
          onSubmit={async (ev) => {
            ev.preventDefault();
            try {
              await upd({
                data: {
                  session_id: d.session.id,
                  person: v.person || null,
                  outcome: v.outcome || null,
                  ability: v.ability || null,
                  evidence: v.evidence || null,
                },
              });
              setEdit(false);
              onChange();
            } catch (err) {
              toast.error(errText(err));
            }
          }}
        >
          {parts.map(([k, l]) => (
            <Input
              key={k}
              aria-label={l}
              placeholder={l}
              value={v[k]}
              onChange={(x) => setV({ ...v, [k]: x.target.value })}
            />
          ))}
          <Button size="sm" type="submit">
            Save
          </Button>
        </form>
      )}
    </section>
  );
}

function Prompts({ d, onChange }: { d: Row; onChange: () => void }) {
  const res = useServerFn(resolveFinding);
  const open = d.findings.filter((f: Row) => f.state === "open");
  const ps = d.session.body.participants as Participant[];
  const act = async (id: string, action: string, extra: Row = {}) => {
    try {
      await res({ data: { finding_id: id, action: action as never, ...extra } });
      onChange();
    } catch (e) {
      toast.error(errText(e));
    }
  };
  const due = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const holder = ps.find((p) => p.decision_authority)?.id;
  const label: Record<string, string> = {
    contradiction: "Contradiction",
    prior_need: "Prior need",
    prior_decision: "Prior decision",
    prior_behavior: "Prior behaviour",
    capability_reuse: "Capability reuse",
    disproven_assumption: "Disproven assumption",
    materiality_question: "Is this material?",
    dependency_proposed: "Proposed relationship",
  };
  return (
    <section className="rounded-md border bg-panel p-3 text-sm" aria-label="Live prompts">
      <h2 className="label-caps">Live prompts · {open.length}</h2>
      <ul className="mt-2 max-h-[30rem] space-y-2 overflow-auto" aria-live="polite">
        {open.map((f: Row) => (
          <li
            key={f.id}
            className={`rounded border p-2 ${f.kind === "contradiction" ? "border-destructive" : ""}`}
          >
            <p className="text-xs text-muted-foreground">
              {label[f.kind] ?? f.kind}
              {f.latency_ms != null ? ` · surfaced in ${f.latency_ms} ms` : ""}
            </p>
            <p>{f.message}</p>
            {f.kind === "contradiction" && f.payload?.explanation && (
              <p className="text-xs text-muted-foreground">{f.payload.explanation}</p>
            )}
            <div className="mt-1 flex flex-wrap gap-1">
              {f.kind === "contradiction" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => act(f.id, "prior_stands")}>
                    Prior stands
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => act(f.id, "new_stands")}>
                    New stands
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act(f.id, "defer", { owner_participant_id: holder, due })}
                  >
                    Defer a week
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act(f.id, "accepted_ambiguity")}
                  >
                    Accept ambiguity
                  </Button>
                </>
              )}
              {["prior_need", "prior_behavior", "prior_decision", "disproven_assumption"].includes(
                f.kind,
              ) && (
                <>
                  <Button size="sm" variant="outline" onClick={() => act(f.id, "link")}>
                    Link
                  </Button>
                  {f.kind === "prior_need" && (
                    <Button size="sm" variant="outline" onClick={() => act(f.id, "supersede")}>
                      Supersede
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => act(f.id, "dismiss")}>
                    Dismiss
                  </Button>
                </>
              )}
              {f.kind === "capability_reuse" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => act(f.id, "experience_first")}>
                    Experience it first
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => act(f.id, "dismiss")}>
                    Not this
                  </Button>
                </>
              )}
              {f.kind === "materiality_question" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => act(f.id, "yes_record")}>
                    Yes, record it
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => act(f.id, "no_keep")}>
                    No
                  </Button>
                </>
              )}
              {f.kind === "dependency_proposed" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act(f.id, "confirm_relationship")}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act(f.id, "discard_relationship")}
                  >
                    Discard
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
        {!open.length && <li className="text-muted-foreground">Nothing to answer right now.</li>}
      </ul>
      <details className="mt-2 text-xs">
        <summary>Resolved ({d.findings.length - open.length})</summary>
        <ul className="mt-1 space-y-1">
          {d.findings
            .filter((f: Row) => f.state !== "open")
            .map((f: Row) => (
              <li key={f.id}>
                {f.state} · {f.message}
              </li>
            ))}
        </ul>
      </details>
    </section>
  );
}

function MaterialRail({ d }: { d: Row }) {
  const items = useMemo(
    () =>
      d.objects.filter(
        (o: Row) =>
          o.type === "ExtractedStatement" &&
          o.lifecycle_state === "draft" &&
          !o.is_tombstone &&
          o.body.material &&
          !o.body.deferral,
      ),
    [d.objects],
  );
  const openQs = d.findings.filter(
    (f: Row) =>
      f.state === "open" && (f.kind === "contradiction" || f.kind === "materiality_question"),
  ).length;
  return (
    <section
      className="rounded-md border bg-panel p-3 text-sm"
      aria-label="Material items awaiting confirmation"
    >
      <h2 className="label-caps">Material items · {items.length}</h2>
      <p className="text-xs text-muted-foreground">
        The session cannot close while these, or {openQs} open contradiction/materiality
        question(s), are unaddressed. Confirm, reject or defer each.
      </p>
      <ul className="mt-1 space-y-1">
        {items.map((x: Row) => (
          <li key={x.id}>
            <span className="ident">{x.human_ref}</span> {x.title}
          </li>
        ))}
      </ul>
    </section>
  );
}

export { MODALITIES };
