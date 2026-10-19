import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listDecisionQueue, respondToDecision } from "@/lib/authority.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/decisions")({
  head: () => ({
    meta: [
      { title: "Human Decision Queue · THREAD" },
      {
        name: "description",
        content:
          "Decisions the authority engine cannot safely make, with the evidence needed to decide.",
      },
      { property: "og:title", content: "Human Decision Queue · THREAD" },
      {
        property: "og:description",
        content:
          "Decisions the authority engine cannot safely make, with the evidence needed to decide.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DecisionsPage,
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
type Item = Awaited<ReturnType<typeof listDecisionQueue>>[number];
const FIELD_LABELS: Record<string, string> = {
  exact_decision_required: "Decision required",
  reason_ai_cannot_safely_decide: "Why the system cannot decide",
  current_evidence_and_confidence: "Evidence and confidence",
  ai_recommendation: "Recommendation",
  viable_alternatives: "Alternatives",
  affected_parties: "Affected parties",
  deadline: "Deadline",
  cost_of_waiting: "Cost of waiting",
  reversibility: "Reversibility",
  current_authority_boundary: "Current authority boundary",
  proposed_next_machine_action: "Next machine action",
};

function DecisionsPage() {
  const list = useServerFn(listDecisionQueue);
  const q = useQuery({ queryKey: ["decisions"], queryFn: () => list() });
  const open = (q.data ?? []).filter((i) => i.open);
  const done = (q.data ?? []).filter((i) => !i.open);
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <header>
        <h1 className="text-lg">Human Decision Queue</h1>
        <p className="text-sm text-muted-foreground">
          The only place THREAD waits for a person. Each request holds exactly what you need to
          decide, request one clarification, reduce authority or stop.
        </p>
      </header>
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!q.isLoading && open.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing needs your decision.</p>
      )}
      {open.map((i) => (
        <Request key={i.id} item={i} />
      ))}
      {done.length > 0 && (
        <section>
          <h2 className="label-caps mb-2">Decided</h2>
          <ul className="space-y-1 text-sm">
            {done.map((i) => {
              const d = i.decisions.find(
                (x) => (x.body as Record<string, unknown>)["response"] !== "request_clarification",
              );
              const b = (d?.body ?? {}) as Record<string, unknown>;
              return (
                <li key={i.id}>
                  <Link to="/canon" search={{ id: i.id }} className="ident underline">
                    {i.human_ref}
                  </Link>{" "}
                  {i.title} — {String(b["response"] ?? "").replaceAll("_", " ")}:{" "}
                  {String(b["decision"] ?? "")}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

function show(v: unknown): React.ReactNode {
  if (Array.isArray(v))
    return (
      <ul className="list-disc pl-4">
        {v.map((x, i) => (
          <li key={i}>
            {typeof x === "object" && x
              ? Object.values(x as object)
                  .map((y) => (Array.isArray(y) ? y.join(", ") : String(y)))
                  .join(" — ")
              : String(x)}
          </li>
        ))}
      </ul>
    );
  if (v && typeof v === "object")
    return Object.entries(v as object)
      .map(([k, y]) => `${k.replaceAll("_", " ")}: ${String(y)}`)
      .join(" · ");
  return String(v ?? "");
}

function Request({ item }: { item: Item }) {
  const qc = useQueryClient();
  const respond = useServerFn(respondToDecision);
  const body = item.body as Record<string, unknown>;
  const [decision, setDecision] = useState("");
  const [rationale, setRationale] = useState("");
  const [reduceTo, setReduceTo] = useState<
    "observe" | "recommend" | "act_with_confirmation" | "act_bounded"
  >("observe");
  const [busy, setBusy] = useState(false);
  async function send(
    response: "decide" | "request_clarification" | "reduce_authority" | "stop_mission",
  ) {
    if (!decision.trim() || !rationale.trim()) {
      toast.error("Write the decision (or question) and a rationale.");
      return;
    }
    setBusy(true);
    try {
      const r = await respond({
        data: {
          request_id: item.id,
          response,
          decision,
          rationale,
          reduce_to: response === "reduce_authority" ? reduceTo : undefined,
        },
      });
      toast.success(`Recorded as ${r.human_ref}`);
      setDecision("");
      setRationale("");
      qc.invalidateQueries({ queryKey: ["decisions"] });
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  }
  const evidenceId = body["current_evidence_and_confidence"];
  return (
    <article className="rounded-md border bg-panel p-3 text-sm" aria-labelledby={`h-${item.id}`}>
      <h2 id={`h-${item.id}`} className="mb-2">
        <span className="ident">{item.human_ref}</span> {item.title}
      </h2>
      <dl className="grid gap-x-3 gap-y-1 sm:grid-cols-[12rem_1fr]">
        {Object.keys(FIELD_LABELS).map((k) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{FIELD_LABELS[k]}</dt>
            <dd>
              {k === "current_evidence_and_confidence" && typeof evidenceId === "string" ? (
                <Link to="/canon" search={{ id: evidenceId }} className="underline">
                  Open the policy evaluation
                </Link>
              ) : k === "deadline" ? (
                new Date(String(body[k])).toLocaleString()
              ) : (
                show(body[k])
              )}
            </dd>
          </div>
        ))}
      </dl>
      {item.decisions
        .filter((d) => (d.body as Record<string, unknown>)["response"] === "request_clarification")
        .map((d) => (
          <p key={d.id} className="mt-2 text-xs">
            Clarification requested ({d.human_ref}):{" "}
            {String((d.body as Record<string, unknown>)["decision"])}
          </p>
        ))}
      <div className="mt-3 grid gap-2 border-t pt-3">
        <Label htmlFor={`d-${item.id}`}>Your decision or question</Label>
        <Textarea
          id={`d-${item.id}`}
          rows={2}
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
        />
        <Label htmlFor={`r-${item.id}`}>Rationale</Label>
        <Textarea
          id={`r-${item.id}`}
          rows={2}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={busy} onClick={() => send("decide")}>
            Decide
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || item.clarification_used}
            onClick={() => send("request_clarification")}
          >
            {item.clarification_used ? "Clarification used" : "Request one clarification"}
          </Button>
          <select
            aria-label="Reduce authority to"
            className="h-8 rounded-md border bg-background px-2 text-xs"
            value={reduceTo}
            onChange={(e) => setReduceTo(e.target.value as typeof reduceTo)}
          >
            <option value="observe">observe</option>
            <option value="recommend">recommend</option>
            <option value="act_with_confirmation">act with confirmation</option>
            <option value="act_bounded">act bounded</option>
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => send("reduce_authority")}
          >
            Reduce authority
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => send("stop_mission")}
          >
            Stop
          </Button>
        </div>
      </div>
    </article>
  );
}
