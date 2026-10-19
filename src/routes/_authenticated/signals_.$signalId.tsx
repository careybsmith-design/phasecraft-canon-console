import { createFileRoute, Link } from "@tanstack/react-router";
import { useSurface, EvidenceLink, errorText } from "@/components/human-surfaces";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/signals/$signalId")({
  head: () => ({
    meta: [
      { title: "Value Signal · THREAD" },
      { name: "description", content: "One observed condition: its origin channel, evidence, intake record and promotion decision." },
      { property: "og:title", content: "Value Signal · THREAD" },
      { property: "og:description", content: "The evidence and provenance behind one observed condition worth acting on." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignalDetail,
});

const BODY_LABELS: Record<string, string> = {
  observed_condition: "Observed condition", affected_population: "Affected population", origin_channel: "Origin channel",
  source_ref: "Source reference", intake_event_id: "Intake event", potential_value: "Potential value", urgency: "Urgency",
  possible_causes: "Possible causes", consequences_of_inaction: "Consequences of inaction", requested_solution_candidates: "Solution hypotheses (never the signal itself)",
};

function SignalDetail() {
  const { signalId } = Route.useParams();
  const q = useSurface(signalId);
  const objects = q.data?.objects ?? [];
  const signal = objects.find((o) => o.id === signalId && o.type === "ValueSignal");
  const missions = objects.filter((o) => o.type === "ValueMission" && (o.body["signal_ref"] === signalId || o.body["signal_id"] === signalId));
  const evidence = objects.filter((o) => o.id !== signalId && o.type !== "ValueMission" && Array.isArray(signal?.body["evidence"]) && (signal.body["evidence"] as string[]).includes(o.id));
  if (q.isLoading) return <main className="p-4"><p role="status">Reading signal evidence…</p></main>;
  if (q.error || !signal) return <main className="p-4"><p role="alert" className="text-destructive">{q.error ? errorText(q.error) : "Signal unavailable in your permission context."}</p></main>;
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4">
      <header className="space-y-1">
        <h1 className="text-lg"><span className="ident">{signal.human_ref}</span> · {signal.title}</h1>
        <p className="text-sm">{signal.statement}</p>
        <p className="text-xs text-muted-foreground">v{signal.version} · {signal.lifecycle_state} · T{signal.risk_tier} · {signal.authority_level} · {signal.data_classification}</p>
      </header>
      <section className="space-y-2 border-y py-4">
        <h2 className="label-caps">Condition and provenance</h2>
        <dl className="space-y-2 text-sm">
          {Object.entries(BODY_LABELS).map(([key, label]) => (
            <div key={key} className="grid gap-1 sm:grid-cols-[11rem_1fr]">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-words">{typeof signal.body[key] === "object" ? JSON.stringify(signal.body[key]) : String(signal.body[key] ?? "Not recorded")}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="space-y-2">
        <h2 className="label-caps">Evidence that produced this signal</h2>
        {evidence.length ? <ul className="space-y-2 text-sm">{evidence.map((o) => <li key={o.id}><EvidenceLink object={o} /></li>)}</ul> : <p className="text-sm text-muted-foreground">No linked evidence objects in your permission context.</p>}
      </section>
      <section className="space-y-2">
        <h2 className="label-caps">Missions from this signal</h2>
        {missions.length ? <ul className="space-y-2 text-sm">{missions.map((m) => <li key={m.id}><Link to="/missions/$missionId" params={{ missionId: m.id }} className="underline underline-offset-4"><span className="ident">{m.human_ref}</span> · {m.title}</Link></li>)}</ul> : <p className="text-sm text-muted-foreground">No mission yet. A promoted signal can originate one from the register.</p>}
      </section>
      <nav aria-label="Signal actions" className="flex flex-wrap gap-2 border-t pt-4">
        <Button asChild variant="outline"><Link to="/signals">Back to the register</Link></Button>
        <Button asChild variant="outline"><Link to="/graph" search={{ view: "mission", root: signal.id, overlay: "family" }}>Signal constellation</Link></Button>
      </nav>
    </main>
  );
}
