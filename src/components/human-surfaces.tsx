import { useState, useId } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpRight, Bookmark, Download, X, Compass } from "lucide-react";
import {
  getHumanSurface,
  createMission,
  askCompanion,
  getFollows,
  setFollow,
  refreshSurfaceRendition,
} from "@/lib/human-surfaces.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MissionInput } from "@/domain/human-surfaces";
import { createMissionFromNeed, getNeedPromotedSignals } from "@/lib/session-mission.functions";

export type SurfaceObject = Awaited<ReturnType<typeof getHumanSurface>>["objects"][number];
export type Rendition = Awaited<ReturnType<typeof askCompanion>>;
export const errorText = (error: unknown) => {
  const text = error instanceof Error ? error.message : String(error);
  try {
    const body = JSON.parse(text);
    return String(body.explanation ?? text);
  } catch {
    return text;
  }
};
export function useSurface(root?: string) {
  const read = useServerFn(getHumanSurface);
  return useQuery({ queryKey: ["human-surface", root], queryFn: () => read({ data: { root } }) });
}
export function EvidenceLink({
  object,
  feed = false,
}: {
  object: Pick<SurfaceObject, "id" | "human_ref" | "title">;
  feed?: boolean;
}) {
  return (
    <Link
      to="/canon"
      search={{ id: object.id }}
      className={feed ? "min-w-0 hover:text-primary" : "underline underline-offset-4"}
    >
      <span className={feed ? "ident thread-feed-reference" : "ident"}>{object.human_ref}</span>
      {feed ? <span className="thread-feed-title">{object.title}</span> : <> · {object.title}</>}
    </Link>
  );
}
export function SourcePicker({
  objects,
  selected,
  onChange,
}: {
  objects: SurfaceObject[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [filter, setFilter] = useState("");
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Canon evidence</legend>
      <Input
        aria-label="Find canon evidence"
        placeholder="Reference, condition or title"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="max-h-44 overflow-auto border-y py-2">
        {objects
          .filter((o) => `${o.human_ref} ${o.title}`.toLowerCase().includes(filter.toLowerCase()))
          .map((o) => (
            <label key={o.id} className="flex items-start gap-2 py-1 text-xs">
              <input
                type="checkbox"
                checked={selected.includes(o.id)}
                disabled={!selected.includes(o.id) && selected.length >= 20}
                onChange={(e) =>
                  onChange(
                    e.target.checked ? [...selected, o.id] : selected.filter((id) => id !== o.id),
                  )
                }
              />
              <span>
                <span className="ident">{o.human_ref}</span> {o.title} · {o.lifecycle_state}
              </span>
            </label>
          ))}
        {objects.length === 0 && (
          <p className="text-sm text-muted-foreground">No permitted canon evidence.</p>
        )}
      </div>
    </fieldset>
  );
}
export function RenditionView({ rendition }: { rendition: Rendition }) {
  const read = useServerFn(refreshSurfaceRendition);
  const purpose =
    rendition.body["mode"] === "simulated"
      ? ("Simulation Studio" as const)
      : ("Value Companion" as const);
  const fresh = useQuery({
    queryKey: ["surface-rendition", rendition.id],
    queryFn: () => read({ data: { id: rendition.id, purpose } }),
    refetchInterval: 15000,
    retry: false,
  });
  const sections = rendition.body["sections"] as
    Array<{ heading: string; text: string; cites: string[] }> | undefined;
  if (fresh.error)
    return (
      <p role="alert" className="border-y py-3 text-sm text-destructive">
        {errorText(fresh.error)} Regenerate before using this guidance.
      </p>
    );
  if (fresh.isLoading)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Checking source permissions and currentness…
      </p>
    );
  return (
    <section
      aria-label="Generated guidance"
      aria-live="polite"
      className="space-y-3 border-y py-3 text-sm"
    >
      <div className="text-xs text-muted-foreground">
        <p className="font-medium text-foreground">
          {rendition.marker ?? "Generated from canon. Not canon."}
        </p>
        <p>
          <span className="ident">{rendition.human_ref}</span> ·{" "}
          {new Date(rendition.generated_at).toLocaleString()} · {rendition.generator.model}
        </p>
        <p>
          Expires on source change or{" "}
          {rendition.expires_at
            ? new Date(rendition.expires_at).toLocaleString()
            : "its recorded expiry"}
          .
        </p>
      </div>
      {Boolean(rendition.body["challenge"]) && (
        <p className="font-medium">{String(rendition.body["challenge"])}</p>
      )}
      {sections?.map((s, i) => (
        <div key={i}>
          <h3 className="font-medium">{s.heading}</h3>
          <p className="whitespace-pre-wrap">{s.text}</p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs">
            {s.cites.map((id) => {
              const source = rendition.generated_from.find((r) => r.id === id);
              return source ? (
                <Link key={id} to="/canon" search={{ id }} className="ident underline">
                  {source.human_ref} · v{source.version}
                </Link>
              ) : null;
            })}
          </div>
        </div>
      ))}
      {Boolean(rendition.body["note"]) && (
        <p className="text-xs text-muted-foreground">{String(rendition.body["note"])}</p>
      )}
    </section>
  );
}
export function CompanionPanel({
  docked = false,
  onClose,
}: {
  docked?: boolean;
  onClose?: () => void;
}) {
  const q = useSurface();
  const ask = useServerFn(askCompanion);
  const [statement, setStatement] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [result, setResult] = useState<Rendition | null>(null);
  const [busy, setBusy] = useState(false);
  const uid = useId();
  const objects = q.data?.objects ?? [];
  async function respond() {
    setBusy(true);
    setResult(null);
    try {
      setResult(await ask({ data: { statement, source_ids: sources } }));
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`space-y-4 ${docked ? "p-4" : ""}`}>
      <header className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-lg">
          <Compass size={18} />
          Value Companion
        </h1>
        {onClose && (
          <Button
            size="icon"
            variant="ghost"
            title="Close companion"
            aria-label="Close companion"
            onClick={onClose}
          >
            <X size={18} />
          </Button>
        )}
      </header>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void respond();
        }}
      >
        <Label htmlFor={uid}>Current business condition</Label>
        <Textarea
          id={uid}
          autoFocus
          required
          maxLength={2000}
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          rows={3}
        />
        {q.error ? (
          <p role="alert" className="text-sm text-destructive">
            {errorText(q.error)}
          </p>
        ) : (
          <SourcePicker objects={objects} selected={sources} onChange={setSources} />
        )}
        <Button type="submit" disabled={busy || !sources.length}>
          {busy ? "Checking evidence…" : "Challenge with evidence"}
        </Button>
      </form>
      {result && <RenditionView rendition={result} />}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link to="/signals">Record a Value Signal</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/missions">Find related mission</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/fabric">Search reusable capabilities</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/capture">Begin co-creation</Link>
        </Button>
      </div>
    </div>
  );
}
const MISSION_FIELDS = {
  title: "Mission name",
  measurable_condition: "Measurable condition",
  baseline: "Baseline",
  target: "Target condition",
  affected_population: "Affected population",
  operating_boundaries: "Operating boundaries",
  proof_required: "Required production evidence",
  co_creator: "Business Co-Creator account ID",
  builder: "Builder account ID",
  decision_authority: "Co-Creator decision authority",
  value_hypothesis: "Value hypothesis",
  stop_conditions: "Stop conditions",
  maximum_investment: "Maximum investment",
  review_date: "Decision / review date",
};
export function MissionForm({
  objects,
  signalId,
  needId,
}: {
  objects: SurfaceObject[];
  signalId?: string;
  needId?: string;
}) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [signal, setSignal] = useState(signalId ?? "");
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState("");
  const uid = useId();
  const create = useServerFn(createMission);
  const fromNeed = useServerFn(createMissionFromNeed);
  const findSignals = useServerFn(getNeedPromotedSignals);
  const matching = useQuery({
    queryKey: ["need-promoted-signals", needId],
    enabled: Boolean(needId),
    queryFn: () => (needId ? findSignals({ data: { need_id: needId } }) : Promise.resolve([])),
  });
  const navigate = useNavigate();
  return (
    <details className="border-y py-3">
      <summary className="cursor-pointer text-sm font-medium">
        Establish a bounded Value Mission
      </summary>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setIssue("");
          const parsed = MissionInput.safeParse({
            ...fields,
            signal_id: signal,
            maximum_investment: Number(fields["maximum_investment"]),
            risk_tier: "1",
          });
          if (!parsed.success) {
            setIssue(parsed.error.issues.map((i) => i.message).join("; "));
            return;
          }
          setBusy(true);
          try {
            const r = needId
              ? await fromNeed({
                  data: {
                    need_id: needId,
                    mission: parsed.data,
                    rationale: "Mission established from this confirmed session need",
                  },
                })
              : await create({ data: parsed.data });
            toast.success(`Recorded ${r.human_ref}`);
            await navigate({ to: "/missions/$missionId", params: { missionId: r.id } });
          } catch (err) {
            setIssue(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor={`${uid}-signal`}>Source Value Signal</Label>
          {needId && (
            <p className="text-xs text-muted-foreground">
              {matching.data?.length
                ? `${matching.data.length} related promoted signal(s) found`
                : "Intent awaiting a signal — record and promote the condition first."}
            </p>
          )}
          {matching.error && (
            <p role="alert" className="text-sm text-destructive">
              {errorText(matching.error)}
            </p>
          )}
          {(() => {
            const promoted = objects.filter(
              (o) => o.type === "ValueSignal" && o.lifecycle_state === "promoted",
            );
            return (
              <>
                <select
                  id={`${uid}-signal`}
                  required
                  value={signal}
                  onChange={(e) => setSignal(e.target.value)}
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">Select signal</option>
                  {[...promoted]
                    .sort(
                      (a, b) =>
                        Number(matching.data?.some((s) => s.id === b.id)) -
                        Number(matching.data?.some((s) => s.id === a.id)),
                    )
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.human_ref} · {o.title}
                      </option>
                    ))}
                </select>
                {promoted.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No promoted signal exists yet — a mission can only begin from one.
                  </p>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link to="/signals">Record a new signal</Link>
                </Button>
              </>
            );
          })()}
        </div>
        {Object.entries(MISSION_FIELDS).map(([key, label]) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={`${uid}-${key}`}>{label}</Label>
            <Input
              id={`${uid}-${key}`}
              required
              type={
                key === "maximum_investment" ? "number" : key === "review_date" ? "date" : "text"
              }
              min={key === "maximum_investment" ? 0 : undefined}
              value={fields[key] ?? ""}
              onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
            />
          </div>
        ))}
        {issue && (
          <p role="alert" className="text-sm text-destructive sm:col-span-2">
            {issue}
          </p>
        )}
        <Button type="submit" disabled={busy} className="justify-self-start">
          {busy ? "Recording…" : "Establish mission"}
        </Button>
      </form>
    </details>
  );
}
const FEED_TYPES = [
  "ValueSignal",
  "ValueMission",
  "ValueBurst",
  "ComposableCapability",
  "ProductionOutcome",
  "ValueMeasure",
  "Lesson",
  "Guardrail",
  "ShadowRun",
  "Incident",
];
export function ValueFeed() {
  const q = useSurface();
  const followsFn = useServerFn(getFollows);
  const follows = useQuery({ queryKey: ["surface-follows"], queryFn: () => followsFn() });
  const follow = useServerFn(setFollow);
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [followingOnly, setFollowingOnly] = useState(false);
  const [domain, setDomain] = useState("");
  const objects = q.data?.objects ?? [];
  const matchesFollow = (o: SurfaceObject) =>
    (follows.data ?? []).some(
      (f) => f.value === o.id || f.value === o.type || f.value === String(o.body["domain"] ?? ""),
    );
  const entries = objects.filter(
    (o) =>
      FEED_TYPES.includes(o.type) &&
      (!followingOnly || matchesFollow(o)) &&
      `${o.title} ${o.statement} ${o.human_ref}`.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <main className="thread-feed mx-auto space-y-5">
      <header className="thread-feed-header flex flex-wrap items-center justify-between gap-4">
        <h1>Live Enterprise Value Feed</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/signals">Record a signal</Link>
          </Button>
          <Button asChild>
            <Link to="/fabric">
              Reuse or remix a capability <ArrowUpRight size={16} />
            </Link>
          </Button>
        </div>
      </header>
      <div className="thread-feed-toolbar flex flex-wrap items-center gap-3">
        <Input
          aria-label="Filter value evidence"
          placeholder="Condition, domain or reference"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={followingOnly}
            onChange={(e) => setFollowingOnly(e.target.checked)}
          />
          Following
        </label>
        <Input
          aria-label="Domain to follow"
          placeholder="Domain to follow"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="max-w-48"
        />
        <Button
          size="icon"
          variant="outline"
          title="Follow domain"
          aria-label="Follow domain"
          disabled={!domain.trim()}
          onClick={async () => {
            try {
              await follow({ data: { kind: "domain", value: domain, following: true } });
              await qc.invalidateQueries({ queryKey: ["surface-follows"] });
              setDomain("");
            } catch (e) {
              toast.error(errorText(e));
            }
          }}
        >
          <Bookmark size={16} />
        </Button>
      </div>
      {(follows.data ?? []).length > 0 && (
        <ul className="flex flex-wrap gap-3 text-xs">
          {follows.data?.map((f) => (
            <li key={`${f.kind}-${f.value}`} className="flex items-center gap-1">
              <span>
                {f.kind} · {objects.find((o) => o.id === f.value)?.title ?? f.value}
              </span>
              <Button
                variant="ghost"
                size="icon"
                title="Unfollow"
                aria-label={`Unfollow ${f.value}`}
                onClick={async () => {
                  try {
                    await follow({ data: { ...f, kind: f.kind as "domain", following: false } });
                    await qc.invalidateQueries({ queryKey: ["surface-follows"] });
                  } catch (e) {
                    toast.error(errorText(e));
                  }
                }}
              >
                <X size={14} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {q.isLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          Reading permitted evidence…
        </p>
      )}
      {q.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorText(q.error)}
        </p>
      )}
      <div className="thread-feed-list divide-y">
        {entries.map((o) => (
          <article key={o.id} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <EvidenceLink object={o} feed />
              <span className="text-xs text-muted-foreground">
                {o.type} · {o.lifecycle_state}
              </span>
            </div>
            <p className="thread-feed-statement text-sm">{o.statement}</p>
            <div className="thread-feed-actions flex flex-wrap items-center gap-3 text-xs">
              <Button variant="outline" size="sm" asChild>
                <Link
                  to="/fabric"
                  search={{
                    outcome: o.statement,
                    capability: o.type === "ComposableCapability" ? o.id : undefined,
                  }}
                >
                  Reuse or remix this capability <ArrowUpRight size={14} />
                </Link>
              </Button>
              {o.type === "ValueMission" && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/missions/$missionId" params={{ missionId: o.id }}>
                    Open current decision
                  </Link>
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                aria-label={`${matchesFollow(o) ? "Unfollow" : "Follow"} ${o.human_ref}`}
                title={`${matchesFollow(o) ? "Unfollow" : "Follow"} ${o.human_ref}`}
                onClick={async () => {
                  try {
                    await follow({
                      data: {
                        kind:
                          o.type === "ValueMission"
                            ? "mission"
                            : o.type === "ComposableCapability"
                              ? "capability"
                              : "learning",
                        value: o.id,
                        following: !matchesFollow(o),
                      },
                    });
                    await qc.invalidateQueries({ queryKey: ["surface-follows"] });
                  } catch (e) {
                    toast.error(errorText(e));
                  }
                }}
              >
                <Bookmark size={15} />
              </Button>
              <Link
                to="/canon"
                search={{ id: o.id }}
                className="ident text-muted-foreground underline underline-offset-4"
              >
                v{o.version} · T{o.risk_tier} · {o.authority_level}
              </Link>
              {o.body["adapter_mode"] === "simulated" && (
                <span className="text-warn">Simulated evidence · not realised value</span>
              )}
            </div>
          </article>
        ))}
        {!q.isLoading && !q.error && entries.length === 0 && (
          <p className="py-6 text-sm text-muted-foreground">No permitted value events match.</p>
        )}
      </div>
      <MissionForm objects={objects} />
    </main>
  );
}
export function ExportEvidence({ name, value }: { name: string; value: unknown }) {
  return (
    <Button
      variant="outline"
      size="icon"
      title="Export evidence data"
      aria-label="Export evidence data"
      onClick={() => {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = `${name}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      <Download size={16} />
    </Button>
  );
}
