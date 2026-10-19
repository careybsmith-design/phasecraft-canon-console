import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  listEvidenceRoots,
  explainAll,
  runTrace,
  getPhase5Evidence,
  runPhase5Evidence,
} from "@/lib/evidence.functions";
import { QUESTIONS, TRACES } from "@/domain/evidence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/evidence")({
  head: () => ({
    meta: [
      { title: "Evidence Graph · THREAD" },
      {
        name: "description",
        content:
          "Trace any capability from signal to decision, build, tests, exposure, production and value.",
      },
      { property: "og:title", content: "Evidence Graph · THREAD" },
      {
        property: "og:description",
        content:
          "Trace any capability from signal to decision, build, tests, exposure, production and value.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EvidencePage,
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
type Root = Awaited<ReturnType<typeof listEvidenceRoots>>[number];

export function EvidencePage({
  capabilityId,
  onSelect,
}: {
  capabilityId?: string;
  onSelect?: (id: string) => void;
}) {
  const lr = useServerFn(listEvidenceRoots);
  const roots = useQuery({ queryKey: ["evidence-roots"], queryFn: () => lr() });
  const [selectedId, setId] = useState<string | null>(null);
  const id = capabilityId ?? selectedId;
  return (
    <main className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <header className="thread-page-heading">
        <h1>Evidence graph</h1>
      </header>
      <section className="min-w-0 space-y-4">
        <Picker roots={roots.data ?? []} id={id} setId={onSelect ?? setId} />
        {id ? (
          <Explain id={id} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Choose a capability, behaviour, decision, exposure, outcome or incident to see its
            evidence chain.
          </p>
        )}
      </section>
      <section className="min-w-0 space-y-4">
        <Traces roots={roots.data ?? []} />
        <ExitEvidence />
      </section>
    </main>
  );
}

function Picker({
  roots,
  id,
  setId,
}: {
  roots: Root[];
  id: string | null;
  setId: (s: string) => void;
}) {
  const [f, setF] = useState("");
  const shown = useMemo(
    () =>
      roots
        .filter((r) =>
          `${r.human_ref} ${r.title} ${r.type}`.toLowerCase().includes(f.toLowerCase()),
        )
        .slice(0, 40),
    [roots, f],
  );
  return (
    <div className="space-y-2 rounded border p-3">
      <h2 className="text-sm font-medium">Explain an object</h2>
      <Input
        placeholder="Filter by ref, title or type"
        value={f}
        onChange={(e) => setF(e.target.value)}
        aria-label="Filter objects"
      />
      <ul className="max-h-48 overflow-auto text-sm">
        {shown.map((r) => (
          <li key={r.id}>
            <Button
              variant="ghost"
              onClick={() => setId(r.id)}
              className={`h-auto w-full justify-start truncate px-1 py-0.5 text-left ${r.id === id ? "bg-accent" : ""}`}
            >
              <span className="ident">{r.human_ref}</span> · {r.title}{" "}
              <span className="text-muted-foreground">
                ({r.type}, {r.lifecycle_state})
              </span>
            </Button>
          </li>
        ))}
        {shown.length === 0 && <li className="text-muted-foreground">Nothing visible yet.</li>}
      </ul>
    </div>
  );
}

function Explain({ id }: { id: string }) {
  const ex = useServerFn(explainAll);
  const q = useQuery({ queryKey: ["explain", id], queryFn: () => ex({ data: { id } }) });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Tracing…</p>;
  if (q.error) return <p className="text-sm text-destructive">{errText(q.error)}</p>;
  const d = q.data;
  if (!d) return <p role="alert">Evidence unavailable in your permission context.</p>;
  return (
    <div className="space-y-4">
      <div className="rounded border p-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">
            <span className="ident">{d.root.ref}</span> {d.root.title}
          </h2>
          <span className="text-xs text-muted-foreground">
            {d.completeness.present} of 8 links · {d.ms} ms
          </span>
        </div>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Evidence chain">
          {d.links.map((l) => (
            <li
              key={l.link}
              className={`rounded border p-2 text-xs ${l.objects.length ? "" : "border-dashed text-muted-foreground"}`}
            >
              <div className="font-medium">
                {l.hop}. {l.label}
              </div>
              {l.objects.length ? (
                l.objects.slice(0, 4).map((o) => (
                  <div key={o.id} className="truncate" title={o.title}>
                    <span className="ident">{o.ref}</span> {o.title}
                  </div>
                ))
              ) : (
                <div>missing</div>
              )}
              {l.objects.length > 4 && <div>+{l.objects.length - 4} more</div>}
            </li>
          ))}
        </ol>
      </div>
      <div className="space-y-2 rounded border p-3">
        <h2 className="text-sm font-medium">The nine questions</h2>
        {QUESTIONS.map((qq) => {
          const a = d.answers.find((x) => x.question === qq.q);
          return (
            <div key={qq.q} className="text-sm">
              <div className="font-medium">{qq.label}</div>
              <p className={a?.answered ? "" : "text-muted-foreground"}>{a?.answer}</p>
              {!!a?.citations.length && (
                <p className="text-xs text-muted-foreground">
                  Cites:{" "}
                  {a.citations.map((c) => (
                    <span key={c.id} className="ident mr-2" title={`${c.type}: ${c.title}`}>
                      {c.ref}
                    </span>
                  ))}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Traces({ roots }: { roots: Root[] }) {
  const rt = useServerFn(runTrace);
  const [sel, setSel] = useState<Record<number, string>>({});
  const [out, setOut] = useState<
    Record<
      number,
      | {
          ms: number;
          within: boolean;
          budget: number;
          summary: string;
          rows: { id: string; ref: string; title: string }[];
        }
      | string
    >
  >({});
  const fits = (input: string | null, r: Root) =>
    input === "any" ||
    r.type === input ||
    (input === "Canon" &&
      ["Guardrail", "Pattern", "Authority", "Rule", "AuthorityGrant"].includes(r.type));
  async function run(n: number) {
    const t = TRACES.find((x) => x.n === n);
    if (!t) return;
    try {
      const r = await rt({ data: { fn: t.fn, id: sel[n] } });
      const res = JSON.parse(r.result) as {
        rows?: unknown;
        nodes?: unknown;
        links?: unknown;
        reaches_decision?: boolean;
        count?: number;
      };
      const nodes = (res.rows ?? res.nodes ?? []) as { id: string; ref: string; title: string }[];
      const chain = res.links as { objects: unknown[] }[] | undefined;
      const summary = chain
        ? `${chain.filter((l) => l.objects.length).length} of 8 links present`
        : res.reaches_decision !== undefined
          ? res.reaches_decision
            ? "Reaches a Confirmed Decision"
            : "Does not reach a Confirmed Decision"
          : `${(res.count as number) ?? nodes.length} result(s)`;
      setOut((o) => ({
        ...o,
        [n]: { ms: r.ms, within: r.within, budget: r.budget, summary, rows: nodes.slice(0, 20) },
      }));
    } catch (e) {
      setOut((o) => ({ ...o, [n]: errText(e) }));
    }
  }
  return (
    <div className="space-y-3 rounded border p-3">
      <h2 className="text-sm font-medium">Traceability queries</h2>
      {TRACES.map((t) => {
        const o = out[t.n];
        return (
          <div key={t.n} className="space-y-1 border-t pt-2 text-sm first:border-t-0 first:pt-0">
            <div className="flex items-center justify-between gap-2">
              <span>
                {t.n}. {t.label}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => run(t.n)}
                disabled={!!t.input && !sel[t.n]}
              >
                Run
              </Button>
            </div>
            {t.input && (
              <select
                aria-label={`Start object for query ${t.n}`}
                className="w-full rounded border bg-background p-1 text-xs"
                value={sel[t.n] ?? ""}
                onChange={(e) => setSel((s) => ({ ...s, [t.n]: e.target.value }))}
              >
                <option value="">Choose a starting object…</option>
                {roots
                  .filter((r) => fits(t.input, r))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.human_ref} · {r.title}
                    </option>
                  ))}
              </select>
            )}
            {typeof o === "string" && <p className="text-xs text-destructive">{o}</p>}
            {o && typeof o !== "string" && (
              <div className="text-xs">
                <p className={o.within ? "text-muted-foreground" : "text-destructive"}>
                  {o.summary} · {o.ms} ms (budget {o.budget} ms)
                </p>
                {o.rows.map((r) => (
                  <div key={r.id} className="truncate">
                    <span className="ident">{r.ref}</span> {r.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExitEvidence() {
  const qc = useQueryClient();
  const get = useServerFn(getPhase5Evidence);
  const run = useServerFn(runPhase5Evidence);
  const q = useQuery({ queryKey: ["p5-evidence"], queryFn: () => get() });
  const [busy, setBusy] = useState(false);
  const p = q.data?.payload as
    { selftest?: { passed: boolean; checks: { name: string; pass: boolean }[] } } | undefined;
  return (
    <div className="space-y-2 rounded border p-3 text-sm">
      <h2 className="font-medium">Phase 5 exit evidence</h2>
      {q.data ? (
        <p className="text-xs text-muted-foreground">
          Last recorded as ledger #{q.data.seq}:{" "}
          {p?.selftest?.passed ? "all checks passed" : "some checks failed"}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Not recorded yet.</p>
      )}
      {p?.selftest?.checks.map((c) => (
        <div key={c.name} className="text-xs">
          {c.pass ? "✓" : "✗"} {c.name}
        </div>
      ))}
      <Button
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await run();
            toast.success(`Recorded as ledger #${r.ledger_seq}`);
            await qc.invalidateQueries({ queryKey: ["p5-evidence"] });
          } catch (e) {
            toast.error(errText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Running…" : "Run and record"}
      </Button>
    </div>
  );
}
