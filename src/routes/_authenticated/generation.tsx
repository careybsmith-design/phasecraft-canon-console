/**
 * Phase 8 surface: renditions generated from canon for one person and purpose (Part 10),
 * the morning intelligence brief (10.4) and the Phase 8 exit evidence.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { CANON_MARKER, RENDITION_KINDS, type RenditionKind } from "@/domain/generation";
import {
  generateMyBrief,
  generateRendition,
  getPhase8Evidence,
  listGeneration,
  runPhase8Evidence,
  serveRendition,
  recordRenditionDownload,
} from "@/lib/generation.functions";
import { buildRenditionPdf, deliverFile } from "@/lib/rendition-pdf";

export const Route = createFileRoute("/_authenticated/generation")({
  component: GenerationPage,
  head: () => ({
    meta: [
      { title: "Generation layer — THREAD" },
      {
        name: "description",
        content:
          "Renditions generated from canon for one person and purpose: stamped, cited, expiring and never canon.",
      },
      { property: "og:title", content: "Generation layer — THREAD" },
      {
        property: "og:description",
        content:
          "Renditions generated from canon for one person and purpose: stamped, cited, expiring and never canon.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type List = Awaited<ReturnType<typeof listGeneration>>;
type Served = Awaited<ReturnType<typeof serveRendition>>;
type Evidence = {
  ledger_seq: number;
  selftest: { passed: boolean; checks: { name: string; pass: boolean; detail: string }[] };
};

function parseErr(e: unknown): string {
  try {
    return JSON.parse((e as Error).message).explanation;
  } catch {
    return (e as Error).message;
  }
}

function GenerationPage() {
  const load = useServerFn(listGeneration);
  const gen = useServerFn(generateRendition);
  const serve = useServerFn(serveRendition);
  const brief = useServerFn(generateMyBrief);
  const runEv = useServerFn(runPhase8Evidence);
  const recordDl = useServerFn(recordRenditionDownload);
  const [pdf, setPdf] = useState<{ blob: Blob; name: string; seq: number } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const getEv = useServerFn(getPhase8Evidence);
  const [list, setList] = useState<List | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<Served | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [kind, setKind] = useState<RenditionKind>("capability_explanation");
  const [purpose, setPurpose] = useState("");
  const [focus, setFocus] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [filter, setFilter] = useState("");

  const refresh = useCallback(async () => {
    setList(await load());
    const ev = await getEv();
    if (ev)
      setEvidence({ ledger_seq: ev.seq, selftest: (ev.payload as unknown as Evidence).selftest });
  }, [load, getEv]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (fn: () => Promise<string>) => {
    setMsg("");
    setBusy(true);
    try {
      setMsg(await fn());
      await refresh();
    } catch (e) {
      setMsg(parseErr(e));
    } finally {
      setBusy(false);
    }
  };
  const open = async (id: string, p: string) => {
    setMsg("");
    setPdf(null);
    try {
      setShown(await serve({ data: { id, purpose: p } }));
    } catch (e) {
      setShown(null);
      setMsg(parseErr(e));
    }
  };
  const objs = (list?.objects ?? []).filter(
    (o) =>
      !filter || `${o.human_ref} ${o.title} ${o.type}`.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Generation layer</h1>
        <p className="text-sm text-muted-foreground">
          Everything here is generated from canon for you and one purpose. It cites its sources,
          goes stale when any source changes, and is deleted on a schedule. It never becomes canon.
        </p>
      </header>

      {msg && (
        <p role="status" className="rounded border border-primary/40 p-2 text-sm">
          {msg}
        </p>
      )}

      <section aria-labelledby="brief" className="space-y-2 rounded border p-4">
        <h2 id="brief" className="text-lg font-medium">
          Morning intelligence brief
        </h2>
        <p className="text-sm text-muted-foreground">
          Generated every morning at 05:00 UTC. Only what needs your judgment: decisions, anomalies,
          opportunities and stop recommendations. No progress or activity.
        </p>
        <Button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const r = await brief();
              if (r.skipped) return r.reason ?? "Nothing requires your judgment today.";
              if (r.rendition_id) await open(r.rendition_id, "morning intelligence brief");
              return `Brief ${r.human_ref} generated.`;
            })
          }
        >
          Generate my brief now
        </Button>
      </section>

      <section aria-labelledby="new" className="space-y-3 rounded border p-4">
        <h2 id="new" className="text-lg font-medium">
          Generate a rendition
        </h2>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col">
            Kind
            <select
              className="rounded border bg-background p-1"
              value={kind}
              onChange={(e) => setKind(e.target.value as RenditionKind)}
            >
              {(Object.keys(RENDITION_KINDS) as RenditionKind[])
                .filter((k) => k !== "morning_intelligence_brief")
                .map((k) => (
                  <option key={k} value={k}>
                    {RENDITION_KINDS[k].label}
                    {RENDITION_KINDS[k].media !== "text" ? " (script only)" : ""}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex flex-col">
            Purpose
            <input
              className="w-56 rounded border bg-background p-1"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="onboard a new builder"
            />
          </label>
          <label className="flex min-w-64 flex-1 flex-col">
            Focus (optional)
            <input
              className="rounded border bg-background p-1"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="what should it emphasise?"
            />
          </label>
        </div>
        <label className="flex flex-col text-sm">
          Sources ({sources.length} chosen)
          <input
            className="rounded border bg-background p-1"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filter canon objects…"
          />
        </label>
        <ul className="max-h-56 overflow-auto rounded border text-sm">
          {objs.slice(0, 80).map((o) => (
            <li key={o.id} className="border-t first:border-t-0">
              <label className="flex flex-wrap items-center gap-2 px-2 py-2">
                <input
                  type="checkbox"
                  checked={sources.includes(o.id)}
                  onChange={(e) =>
                    setSources((s) =>
                      e.target.checked ? [...s, o.id].slice(0, 20) : s.filter((x) => x !== o.id),
                    )
                  }
                />
                <span className="ident">{o.human_ref}</span> {o.title}
                <span className="ml-auto text-xs text-muted-foreground">
                  {o.type} · {o.data_classification}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          disabled={busy || !purpose.trim() || sources.length === 0}
          onClick={() =>
            run(async () => {
              const r = await gen({
                data: { kind, purpose: purpose.trim(), request_text: focus, source_ids: sources },
              });
              if (r.refused)
                return `Refused: ${r.reason}. Nothing was generated (recorded as ledger #${r.ledger_seq}).`;
              if (r.rendition_id) await open(r.rendition_id, purpose.trim());
              return `Generated ${r.human_ref} (ledger #${r.ledger_seq}).`;
            })
          }
        >
          {busy ? "Generating…" : "Generate"}
        </Button>
      </section>

      {shown && (
        <section
          aria-labelledby="shown"
          className="space-y-3 rounded border-2 border-dashed border-primary/60 p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {shown.marker ?? CANON_MARKER}
          </p>
          <h2 id="shown" className="text-lg font-medium">
            {shown.body?.title ?? shown.human_ref}{" "}
            <span className="ident text-sm text-muted-foreground">{shown.human_ref}</span>
          </h2>
          {shown.body?.note && <p className="text-sm text-muted-foreground">{shown.body.note}</p>}
          {shown.body?.media && (
            <p className="text-sm text-muted-foreground">
              Media: {shown.body.media.status} — {shown.body.media.note}
            </p>
          )}
          {(shown.body?.sections ?? []).map((s, i) => {
            const items = (s as unknown as { items?: Array<{ text: string; ref: string }> }).items;
            return (
              <div key={i} className="space-y-1">
                <h3 className="font-medium">{s.heading}</h3>
                {items ? (
                  items.length ? (
                    <ul className="list-disc pl-5 text-sm">
                      {items.map((it, j) => (
                        <li key={j}>
                          {it.text}{" "}
                          <span className="ident text-xs text-muted-foreground">[{it.ref}]</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nothing here.</p>
                  )
                ) : (
                  <p className="text-sm">
                    {s.text}{" "}
                    <span className="ident text-xs text-muted-foreground">
                      [
                      {(s.cites ?? [])
                        .map((c) => shown.generated_from.find((g) => g.id === c)?.human_ref ?? c)
                        .join(", ")}
                      ]
                    </span>
                  </p>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            From {shown.generated_from.map((g) => `${g.human_ref} v${g.version}`).join(", ")} ·{" "}
            {shown.generator.model} via {shown.generator.route} ({shown.generator.adapter_mode}) ·{" "}
            {new Date(shown.generated_at).toLocaleString()} · for "
            {shown.permission_context.purpose}". To change what it says,{" "}
            <Link to="/canon" className="underline">
              propose a canon change
            </Link>
            ; renditions are read-only.
          </p>
          <div className="flex flex-wrap items-center gap-3 border-t pt-3">
            {!pdf ? (
              <Button
                type="button"
                variant="outline"
                disabled={preparing}
                onClick={async () => {
                  setPreparing(true);
                  setMsg("");
                  try {
                    const purposeText = shown.permission_context.purpose;
                    const d = await recordDl({ data: { id: shown.id, purpose: purposeText } });
                    const blob = await buildRenditionPdf({
                      human_ref: shown.human_ref,
                      marker: shown.marker ?? CANON_MARKER,
                      title: shown.body?.title ?? shown.human_ref,
                      note: shown.body?.note,
                      sections: (shown.body?.sections ?? []) as never,
                      generated_from: shown.generated_from,
                      generator: shown.generator,
                      generated_at: shown.generated_at,
                      expires_at: d.rendition.expires_at,
                      purpose: purposeText,
                      reader: d.reader,
                      classification: d.classification,
                      ledger_seq: d.ledger_seq,
                      downloaded_at: d.downloaded_at,
                    });
                    setPdf({ blob, name: `${shown.human_ref}.pdf`, seq: d.ledger_seq });
                  } catch (e) {
                    setMsg(parseErr(e));
                  } finally {
                    setPreparing(false);
                  }
                }}
              >
                {preparing ? "Preparing PDF…" : "Prepare PDF"}
              </Button>
            ) : (
              <Button type="button" onClick={() => void deliverFile(pdf.blob, pdf.name)}>
                Download {pdf.name}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              {pdf ? `Download recorded as ledger #${pdf.seq}. ` : ""}A downloaded copy doesn't
              update or expire, so it may go out of date.
            </p>
          </div>
        </section>
      )}

      <section aria-labelledby="mine" className="space-y-2 rounded border p-4">
        <h2 id="mine" className="text-lg font-medium">
          Your renditions
        </h2>
        <div className="thread-table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th>Ref</th>
                <th>Kind</th>
                <th>Purpose</th>
                <th>State</th>
                <th>Sources</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list?.renditions.map((r) => {
                const pc = r.permission_context as { purpose?: string };
                const gf = r.generated_from as Array<{ human_ref?: string; version?: number }>;
                return (
                  <tr key={r.id} className="border-t">
                    <td className="ident py-1">{r.human_ref ?? "—"}</td>
                    <td>{RENDITION_KINDS[r.kind as RenditionKind]?.label ?? r.kind}</td>
                    <td>{pc.purpose}</td>
                    <td>
                      {r.state}
                      {r.state === "stale" && r.stale_reason ? ` — ${r.stale_reason}` : ""}
                    </td>
                    <td className="ident text-xs">
                      {gf.map((g) => `${g.human_ref ?? "?"} v${g.version ?? "?"}`).join(", ")}
                    </td>
                    <td>
                      <Button
                        type="button"
                        variant="link"
                        className="px-0"
                        onClick={() => open(r.id, pc.purpose ?? "")}
                      >
                        Open
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="exit" className="space-y-2 rounded border p-4">
        <h2 id="exit" className="text-lg font-medium">
          Phase 8 exit evidence
        </h2>
        <Button
          type="button"
          disabled={busy}
          variant="outline"
          onClick={() =>
            run(async () => {
              const r = await runEv();
              return `Self-test ${r.selftest.passed ? "passed" : "FAILED"}; recorded as ledger #${r.ledger_seq}.`;
            })
          }
        >
          Run and record
        </Button>
        {evidence && (
          <div className="text-sm">
            <p>
              Ledger #{evidence.ledger_seq}:{" "}
              {evidence.selftest.passed ? "all checks passed" : "some checks failed"}
            </p>
            <ul className="mt-1 space-y-0.5">
              {evidence.selftest.checks.map((c) => (
                <li key={c.name}>
                  {c.pass ? "✓" : "✗"} {c.name}{" "}
                  <span className="text-xs text-muted-foreground">{c.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
