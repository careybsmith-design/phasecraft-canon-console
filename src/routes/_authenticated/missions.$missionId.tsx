import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod/v4";
import { formCell, startBurst, finishBurst } from "@/lib/human-surfaces.functions";
import { getObjectDetail } from "@/lib/canon.functions";
import { useSurface, EvidenceLink, ExportEvidence, errorText } from "@/components/human-surfaces";
import { BURST_PHASES } from "@/domain/human-surfaces";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export const Route = createFileRoute("/_authenticated/missions/$missionId")({
  head: () => ({
    meta: [
      { title: "Mission Runtime · THREAD" },
      {
        name: "description",
        content:
          "The current business decision, mission bounds, uncertainties, capabilities and production evidence.",
      },
      { property: "og:title", content: "Mission Runtime · THREAD" },
      {
        property: "og:description",
        content: "A bounded mission generated around evidence and the next consequential decision.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MissionRuntime,
});
const FIELD_LABELS = {
  measurable_condition: "Measurable condition",
  baseline: "Baseline evidence",
  target: "Target condition",
  affected_population: "Affected population",
  operating_boundaries: "Operating boundaries",
  proof_required: "Production proof required",
  co_creator: "Business Co-Creator",
  builder: "Builder",
  value_hypothesis: "Value hypothesis",
  cause_hypotheses: "Cause hypotheses",
  decision_authority: "Decision authority",
  stop_conditions: "Stop conditions",
  completion_criteria: "Continuation / completion evidence",
  maximum_investment: "Investment ceiling",
  maximum_time: "Expiration boundary",
};
function MissionRuntime() {
  const { missionId } = Route.useParams();
  const q = useSurface(missionId);
  const qc = useQueryClient();
  const cellFn = useServerFn(formCell);
  const burstFn = useServerFn(startBurst);
  const finish = useServerFn(finishBurst);
  const detailFn = useServerFn(getObjectDetail);
  const history = useQuery({
    queryKey: ["mission-history", missionId],
    queryFn: () => detailFn({ data: { id: missionId } }),
  });
  const [busy, setBusy] = useState(false);
  const [minutes, setMinutes] = useState(180);
  const [selectedVersion, setSelectedVersion] = useState(0);
  const [output, setOutput] = useState("");
  const [rationale, setRationale] = useState("");
  const objects = q.data?.objects ?? [];
  const mission = objects.find((o) => o.id === missionId && o.type === "ValueMission");
  const cell = objects.find((o) => o.type === "ValueCell" && o.body["mission_ref"] === missionId);
  const bursts = objects.filter((o) => o.type === "ValueBurst" && o.body["cell_ref"] === cell?.id);
  const nextDecision = objects.find((o) => o.type === "HumanDecisionRequest");
  const capabilities = objects.filter((o) =>
    ["WorkingCapability", "ComposableCapability", "WorkingSkeleton"].includes(o.type),
  );
  const evidence = objects.filter((o) =>
    [
      "ProductionOutcome",
      "ValueMeasure",
      "ShadowRun",
      "SimulationRun",
      "AdversarialRun",
      "ConfirmedDecision",
      "BuildRun",
    ].includes(o.type),
  );
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      toast.success("Recorded with provenance");
      await qc.invalidateQueries({ queryKey: ["human-surface"] });
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (q.isLoading)
    return (
      <main className="p-4">
        <p role="status">Reading mission evidence…</p>
      </main>
    );
  if (q.error || !mission)
    return (
      <main className="p-4">
        <p role="alert" className="text-destructive">
          {q.error ? errorText(q.error) : "Mission unavailable in your permission context."}
        </p>
      </main>
    );
  const archived = history.data?.versions.find((v) => v.version === selectedVersion);
  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg">
            <span className="ident">{mission.human_ref}</span> · {mission.title}
          </h1>
          <p className="mt-1 text-sm">{mission.statement}</p>
        </div>
        <ExportEvidence name={mission.human_ref} value={q.data} />
      </header>
      <section className="space-y-2 border-y py-4">
        <h2 className="label-caps">Originating signal</h2>
        {(() => {
          const signalId = String(mission.body["signal_ref"] ?? mission.body["signal_id"] ?? "");
          const signal = objects.find((o) => o.id === signalId && o.type === "ValueSignal");
          return signal ? (
            <>
              <Link
                to="/signals/$signalId"
                params={{ signalId: signal.id }}
                className="underline underline-offset-4 text-sm"
              >
                <span className="ident">{signal.human_ref}</span> · {signal.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                Origin {String(signal.body["origin_channel"] ?? "recorded before intake")} ·{" "}
                {signal.lifecycle_state} · evidence{" "}
                {Array.isArray(signal.body["evidence"])
                  ? (signal.body["evidence"] as unknown[]).length
                  : 0}{" "}
                reference(s)
              </p>
            </>
          ) : (
            <p role="alert" className="text-sm text-destructive">
              The originating signal cannot be resolved — a mission with no visible signal is a
              defect.
            </p>
          );
        })()}
      </section>
      <section className="space-y-3 border-y py-4">
        <h2 className="label-caps">Current consequential decision</h2>
        {nextDecision ? (
          <EvidenceLink object={nextDecision} />
        ) : (
          <p className="text-sm">No human decision request in the connected evidence.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/decisions">Inspect decision evidence</Link>
          </Button>
          {!cell && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => act(() => cellFn({ data: { mission_id: missionId, agents: [] } }))}
            >
              Form Value Cell
            </Button>
          )}
          {cell && (
            <>
              <Input
                type="number"
                aria-label="Burst duration in minutes"
                min={60}
                max={180}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="w-24"
              />
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  act(() =>
                    burstFn({ data: { cell_id: cell.id, minutes, phases: [...BURST_PHASES] } }),
                  )
                }
              >
                Begin Value Burst
              </Button>
            </>
          )}
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-4">
          <h2 className="label-caps">Why this mission exists and its boundaries</h2>
          <dl className="space-y-2 text-sm">
            {Object.entries(FIELD_LABELS).map(([key, label]) => (
              <div key={key} className="grid gap-1 sm:grid-cols-[11rem_1fr]">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-words">
                  {typeof mission.body[key] === "object"
                    ? JSON.stringify(mission.body[key])
                    : String(mission.body[key] ?? "Evidence not recorded")}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-xs">
            <Link to="/canon" search={{ id: mission.id }} className="ident underline">
              v{mission.version} · {mission.lifecycle_state} · T{mission.risk_tier} ·{" "}
              {mission.authority_level} · {mission.data_classification}
            </Link>
          </p>
          <h2 className="label-caps">Important uncertainties</h2>
          <ul className="space-y-2 text-sm">
            {objects
              .filter((o) => ["Assumption", "OpenQuestion"].includes(o.type))
              .map((o) => (
                <li key={o.id}>
                  <EvidenceLink object={o} />
                </li>
              ))}
          </ul>
          <h2 className="label-caps">Working intervention and available capabilities</h2>
          <ul className="space-y-2 text-sm">
            {capabilities.map((o) => (
              <li key={o.id}>
                <EvidenceLink object={o} /> · {o.lifecycle_state}
              </li>
            ))}
          </ul>
        </section>
        <section className="min-w-0 space-y-4">
          <h2 className="label-caps">Production evidence and confidence</h2>
          <ul className="space-y-3 text-sm">
            {evidence.map((o) => (
              <li key={o.id}>
                <EvidenceLink object={o} />
                <p className="text-xs text-muted-foreground">
                  {o.lifecycle_state} ·{" "}
                  {o.body["adapter_mode"] === "simulated"
                    ? "Simulated — not realised value"
                    : o.type === "ProductionOutcome"
                      ? "Production evidence"
                      : "Recorded evidence"}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Confidence bundle:{" "}
            {mission.confidence_bundle
              ? JSON.stringify(mission.confidence_bundle)
              : "Not yet established from connected evidence."}
          </p>
          <h2 className="label-caps">Cell and active bursts</h2>
          {cell && <EvidenceLink object={cell} />}
          {bursts.map((b) => (
            <div key={b.id} className="space-y-2 border-y py-3">
              <EvidenceLink object={b} />
              <p className="text-xs text-muted-foreground">
                Opened {String(b.body["start"])} · ends {String(b.body["planned_end"])}{" "}
                {b.body["end"] ? "· substantive output recorded" : ""}
              </p>
              {!b.body["end"] && (
                <div className="space-y-2">
                  <Label htmlFor={`output-${b.id}`}>Substantive output reference</Label>
                  <select
                    id={`output-${b.id}`}
                    value={output}
                    onChange={(e) => setOutput(e.target.value)}
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="">Select output</option>
                    {objects
                      .filter((o) =>
                        [
                          "WorkingCapability",
                          "ProductionOutcome",
                          "ConfirmedDecision",
                          "Assumption",
                        ].includes(o.type),
                      )
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.human_ref} · {o.title}
                        </option>
                      ))}
                  </select>
                  <Textarea
                    aria-label="Burst outcome rationale"
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                  />
                  <Button
                    disabled={busy || !output || !rationale.trim()}
                    variant="outline"
                    onClick={() =>
                      act(() =>
                        finish({ data: { burst_id: b.id, output_ids: [output], rationale } }),
                      )
                    }
                  >
                    Record substantive burst outcome
                  </Button>
                </div>
              )}
            </div>
          ))}
          <h2 className="label-caps">State at a point in history</h2>
          <Label htmlFor="mission-history">Version</Label>
          <input
            id="mission-history"
            type="range"
            min={0}
            max={mission.version}
            step={1}
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(Number(e.target.value))}
            className="w-full"
          />
          <p className="text-xs">
            {archived
              ? `v${archived.version} · ${archived.lifecycle_state} · ${archived.updated_at}: ${archived.statement}`
              : "Current connected evidence"}
          </p>
        </section>
      </div>
      <nav aria-label="Mission actions" className="flex flex-wrap gap-2 border-t pt-4">
        <Button asChild variant="outline">
          <Link to="/companion">Challenge the condition</Link>
        </Button>
        <Button asChild variant="outline">
          <Link
            to="/fabric"
            search={{ outcome: String(mission.body["measurable_condition"] ?? mission.statement) }}
          >
            Find capabilities
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/capture">Live co-creation</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/simulate">Run a scenario</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/shadow">Enter production shadow</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/graph" search={{ view: "mission", root: mission.id, overlay: "family" }}>
            Mission Constellation
          </Link>
        </Button>
      </nav>
    </main>
  );
}
