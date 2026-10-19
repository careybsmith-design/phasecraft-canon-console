import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MissionForm, useSurface, EvidenceLink, errorText } from "@/components/human-surfaces";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/signals")({
  head: () => ({
    meta: [
      { title: "Value Signals · THREAD" },
      { name: "description", content: "Observed conditions worth acting on, with the evidence to promote one into a bounded Value Mission." },
      { property: "og:title", content: "Value Signals · THREAD" },
      { property: "og:description", content: "Inspect observed conditions and promote a signal into an evidence-bounded mission." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignalsPage,
});

function SignalsPage() {
  const q = useSurface();
  const [promoting, setPromoting] = useState("");
  const objects = q.data?.objects ?? [];
  const signals = objects.filter((o) => o.type === "ValueSignal");
  const missions = objects.filter((o) => o.type === "ValueMission");
  const promotedFrom = (signalId: string) => missions.find((m) => m.body["signal_ref"] === signalId || m.body["signal_id"] === signalId);
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-lg">Value Signals</h1>
      <p className="text-sm text-muted-foreground">Observed conditions with evidence. Promote a signal into a bounded Value Mission when the condition is worth changing.</p>
      {q.isLoading && <p role="status" className="text-sm text-muted-foreground">Reading permitted signals…</p>}
      {q.error && <p role="alert" className="text-sm text-destructive">{errorText(q.error)}</p>}
      <ul className="divide-y">
        {signals.map((s) => {
          const existing = promotedFrom(s.id);
          return (
            <li key={s.id} className="space-y-2 py-3">
              <EvidenceLink object={s} />
              <p className="text-sm">{s.statement}</p>
              <p className="text-xs text-muted-foreground">{s.lifecycle_state} · {s.authority_level} · urgency {String(s.body["urgency"] ?? "not recorded")} · potential value {String(s.body["potential_value"] ?? "not recorded")}</p>
              {existing ? (
                <p className="text-xs"><Link to="/missions/$missionId" params={{ missionId: existing.id }} className="ident underline">{existing.human_ref}</Link> · mission already established from this signal</p>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setPromoting(promoting === s.id ? "" : s.id)}>{promoting === s.id ? "Close promotion" : "Promote to mission"}</Button>
              )}
              {promoting === s.id && !existing && <MissionForm objects={objects} signalId={s.id} />}
            </li>
          );
        })}
      </ul>
      {!q.isLoading && !q.error && signals.length === 0 && <p className="text-sm text-muted-foreground">No permitted Value Signals. Record one in canon first.</p>}
    </main>
  );
}
