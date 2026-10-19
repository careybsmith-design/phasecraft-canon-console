import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { beginScenario, respondToScenario } from "@/lib/human-surfaces.functions";
import {
  useSurface,
  SourcePicker,
  RenditionView,
  errorText,
  ExportEvidence,
} from "@/components/human-surfaces";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
export const Route = createFileRoute("/_authenticated/simulate")({
  head: () => ({
    meta: [
      { title: "Simulation Studio · THREAD" },
      {
        name: "description",
        content:
          "Adaptive operating scenarios with eight evidence-based learning criteria and a path to a real low-risk mission.",
      },
      { property: "og:title", content: "Simulation Studio · THREAD" },
      {
        property: "og:description",
        content:
          "Practise outcome-first choices without turning practice into production evidence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SimulationStudio,
});
function SimulationStudio() {
  const q = useSurface();
  const start = useServerFn(beginScenario);
  const respond = useServerFn(respondToScenario);
  const [sources, setSources] = useState<string[]>([]);
  const [scenario, setScenario] = useState(
    "A business executive asks you to build a new customer-service application. What do you do next?",
  );
  const [choice, setChoice] = useState("");
  const [current, setCurrent] = useState<Awaited<ReturnType<typeof start>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function go() {
    setBusy(true);
    setError("");
    try {
      const next = current
        ? await respond({ data: { session_id: current.id, response: choice } })
        : await start({ data: { source_ids: sources, scenario } });
      setCurrent(next);
      setChoice("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const feedback = current?.body["feedback"] as
    Array<{ criterion: string; observed: boolean; basis: string }> | undefined;
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg">Simulation Studio</h1>
        {current && <ExportEvidence name={current.human_ref} value={current} />}
      </header>
      <p className="text-xs text-warn">
        Simulated operating situation · rule-based scenario · earns no production authority or
        realised value.
      </p>
      {!current && (
        <>
          <Label htmlFor="scenario">Operating situation</Label>
          <Textarea
            id="scenario"
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            maxLength={1000}
          />
          <SourcePicker objects={q.data?.objects ?? []} selected={sources} onChange={setSources} />
        </>
      )}
      {current && (
        <>
          <RenditionView rendition={current} />
          <h2 className="label-caps">Reflection on the last simulated choice</h2>
          <dl className="divide-y text-sm">
            {feedback?.map((f) => (
              <div key={f.criterion} className="grid gap-1 py-2 sm:grid-cols-[1.3fr_1fr]">
                <dt>{f.criterion}</dt>
                <dd className="text-muted-foreground">
                  {f.observed ? "Explicit in this choice" : "Not yet evidenced in this choice"}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            {String(current.body["evaluation_basis"])}
          </p>
          <Label htmlFor="choice">Your next action and evidence</Label>
          <Textarea
            id="choice"
            autoFocus
            rows={3}
            maxLength={2000}
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
          />
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || (current ? !choice.trim() : !sources.length)} onClick={go}>
          {busy ? "Adapting scenario…" : current ? "Act in this situation" : "Enter scenario"}
        </Button>
        {current && (
          <Button
            variant="outline"
            onClick={() => {
              setCurrent(null);
              setError("");
            }}
          >
            New situation
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link to="/missions">Begin a real, low-risk Value Mission</Link>
        </Button>
      </div>
    </main>
  );
}
