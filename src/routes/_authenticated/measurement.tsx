import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readMeasurements } from "@/lib/detection.functions";
const measurementsQuery = queryOptions({
  queryKey: ["measurements"],
  queryFn: () => readMeasurements(),
});
export const Route = createFileRoute("/_authenticated/measurement")({
  loader: ({ context }) => context.queryClient.ensureQueryData(measurementsQuery),
  component: MeasurementPage,
  head: () => ({
    meta: [
      { title: "Value measurement — THREAD" },
      {
        name: "description",
        content:
          "Evidence-linked flow, quality, value, capability, community and platform-health measures from the operating graph.",
      },
      { property: "og:title", content: "Value measurement — THREAD" },
      {
        property: "og:description",
        content:
          "Confirmed business intent to live production value, measured from operating evidence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
type Json = Record<string, unknown>;
function obj(v: unknown): Json {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};
}
function EvidenceValue({ value }: { value: unknown }) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">Not measured</span>;
  if (Array.isArray(value))
    return value.length ? (
      <div className="space-y-2">
        {value.map((v, i) => (
          <div key={i} className="border-b py-2">
            <EvidenceValue value={v} />
          </div>
        ))}
      </div>
    ) : (
      <p className="text-muted-foreground">No evidence yet.</p>
    );
  if (typeof value === "object")
    return (
      <dl className="space-y-2">
        {Object.entries(obj(value)).map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{k.replaceAll("_", " ")}</dt>
            <dd className="break-words pl-2">
              {k === "id" || k.endsWith("_id") ? (
                <span className="ident break-all">{String(v)}</span>
              ) : (
                <EvidenceValue value={v} />
              )}
            </dd>
          </div>
        ))}
      </dl>
    );
  return (
    <span className="break-words">
      {typeof value === "number" ? Number(value.toFixed(3)).toLocaleString() : String(value)}
    </span>
  );
}
function MeasurementPage() {
  const { data } = useSuspenseQuery(measurementsQuery);
  const s = obj(data);
  const primary = obj(s["primary"]);
  const qc = useQueryClient();
  const [family, setFamily] = useState("flow");
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex justify-between gap-4">
        <div>
          <p className="ident text-muted-foreground">THREAD / VALUE</p>
          <h1 className="mt-2 text-2xl font-semibold">Measurement</h1>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Refresh measures"
          title="Refresh measures"
          onClick={() => qc.invalidateQueries({ queryKey: ["measurements"] })}
        >
          <RefreshCw />
        </Button>
      </header>
      <section className="border-y py-6">
        <h2 className="text-base text-muted-foreground">Median intent-to-value time</h2>
        <p className="mt-2 text-4xl font-semibold">
          {primary["hours"] === null ? "—" : Number(Number(primary["hours"]).toFixed(2))}
          <span className="ml-2 text-base font-normal text-muted-foreground">hours</span>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {String(primary["status"] ?? "Not measured").replaceAll("_", " ")}
        </p>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-primary">
            Production value evidence
          </summary>
          <div className="mt-3">
            <EvidenceValue value={primary["chains"]} />
          </div>
        </details>
      </section>
      <nav aria-label="Measure families" className="flex flex-wrap gap-1 border-b pb-2">
        {["flow", "quality", "value", "capability", "community", "health"].map((f) => (
          <Button
            key={f}
            variant={family === f ? "secondary" : "ghost"}
            onClick={() => setFamily(f)}
          >
            {f === "quality"
              ? "Quality & trust"
              : f === "health"
                ? "Platform health"
                : `${f[0]?.toUpperCase()}${f.slice(1)}`}
          </Button>
        ))}
      </nav>
      <section className="max-w-3xl">
        <EvidenceValue value={s[family]} />
      </section>
      <footer className="flex flex-wrap justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
        <span>Computed {new Date(String(s["computed_at"])).toLocaleString()}</span>
        <Button asChild variant="link" size="sm">
          <Link to="/detectors">Detection →</Link>
        </Button>
      </footer>
    </main>
  );
}
