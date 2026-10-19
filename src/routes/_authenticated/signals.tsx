import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MissionForm, useSurface, EvidenceLink, errorText } from "@/components/human-surfaces";
import {
  recordValueSignal,
  extractSignalFromArtifact,
  startSignalCapture,
  completeSignalCapture,
  abandonSignalCapture,
  confirmDraftSignal,
  promoteSignal,
  linkSignalToMission,
} from "@/lib/signal-intake.functions";
import { PROMOTABLE_STATES, type DraftSignal, type SignalOrigin } from "@/domain/signal-intake";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/signals")({
  head: () => ({
    meta: [
      { title: "Signal Intake and Register · THREAD" },
      {
        name: "description",
        content:
          "Record a condition worth acting on — directly, from a document, or by dictation — and promote it into a bounded Value Mission.",
      },
      { property: "og:title", content: "Signal Intake and Register · THREAD" },
      {
        property: "og:description",
        content:
          "The front door of the value flow: every signal, its origin channel and its promotion decision.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignalsPage,
});

type Channel = "human_expertise" | "artifact_upload" | "live_capture";

function DraftList({
  drafts,
  origin,
  sourceRef,
  onConfirmed,
}: {
  drafts: DraftSignal[];
  origin: SignalOrigin;
  sourceRef?: string;
  onConfirmed: () => void;
}) {
  const confirm = useServerFn(confirmDraftSignal);
  const [busy, setBusy] = useState("");
  if (!drafts.length)
    return (
      <p className="text-sm text-muted-foreground">
        No candidate conditions found in that material. You can record the condition directly
        instead.
      </p>
    );
  return (
    <ul className="space-y-2" aria-label="Draft signal proposals">
      {drafts.map((d, i) => (
        <li key={i} className="space-y-2 border-y py-3">
          <p className="text-sm">{d.observed_condition}</p>
          <p className="text-xs text-muted-foreground">{d.basis}</p>
          <Button
            variant="outline"
            size="sm"
            disabled={busy === d.observed_condition}
            onClick={async () => {
              setBusy(d.observed_condition);
              try {
                const r = await confirm({
                  data: {
                    origin,
                    observed_condition: d.observed_condition,
                    evidence_refs: [],
                    source_ref: sourceRef,
                    extraction_method: origin === "human_expertise" ? "manual" : "model_extraction",
                  },
                });
                if (r.status === "duplicate") {
                  const ex = r.existing_signal!;
                  toast.info(
                    `Already recorded as ${ex.human_ref} — the existing signal is surfaced instead.`,
                  );
                } else toast.success("Signal recorded in detected state");
                onConfirmed();
              } catch (e) {
                toast.error(errorText(e));
              } finally {
                setBusy("");
              }
            }}
          >
            {busy === d.observed_condition ? "Confirming…" : "Confirm this condition"}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function IntakePanel({ onChanged }: { onChanged: () => void }) {
  const [channel, setChannel] = useState<Channel>("human_expertise");
  const [condition, setCondition] = useState("");
  const [population, setPopulation] = useState("");
  const [urgency, setUrgency] = useState("");
  const [value, setValue] = useState("");
  const [artifact, setArtifact] = useState("");
  const [kind, setKind] = useState("document");
  const [purpose, setPurpose] = useState("");
  const [captureId, setCaptureId] = useState("");
  const [transcript, setTranscript] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [drafts, setDrafts] = useState<DraftSignal[]>([]);
  const [draftOrigin, setDraftOrigin] = useState<SignalOrigin>("artifact_upload");
  const [busy, setBusy] = useState(false);
  const record = useServerFn(recordValueSignal);
  const extract = useServerFn(extractSignalFromArtifact);
  const startCapture = useServerFn(startSignalCapture);
  const completeCapture = useServerFn(completeSignalCapture);
  const abandonCapture = useServerFn(abandonSignalCapture);

  async function submitDirect() {
    setBusy(true);
    try {
      const r = await record({
        data: {
          observed_condition: condition,
          affected_population: population || undefined,
          urgency: (urgency || undefined) as never,
          potential_value: value || undefined,
          evidence_refs: [],
        },
      });
      if (r.status === "duplicate") {
        const ex = r.existing_signal!;
        toast.info(
          `Already recorded as ${ex.human_ref} — the existing signal is surfaced instead.`,
        );
      } else toast.success("Signal recorded in detected state");
      setCondition("");
      setPopulation("");
      setUrgency("");
      setValue("");
      onChanged();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function submitArtifact() {
    setBusy(true);
    setDrafts([]);
    try {
      const r = await extract({ data: { artifact_text: artifact, kind } });
      setDrafts(r.proposals);
      setDraftOrigin("artifact_upload");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function openCapture() {
    setBusy(true);
    try {
      const r = await startCapture({
        data: { modalities: ["text"], purpose, consent_confirmed: true },
      });
      setCaptureId(r.capture_id ?? "");
      toast.success("Capture open — your consent confirmation is recorded with it.");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function finishCapture() {
    setBusy(true);
    setDrafts([]);
    try {
      const r = await completeCapture({ data: { capture_id: captureId, transcript } });
      setDrafts(r.draft_signal);
      setDraftOrigin("live_capture");
      setCaptureId("");
      setTranscript("");
      setConsentConfirmed(false);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function dropCapture() {
    setBusy(true);
    try {
      await abandonCapture({ data: { capture_id: captureId } });
      toast.info("Capture abandoned — the attempt is recorded as abandoned.");
      setCaptureId("");
      setTranscript("");
      setConsentConfirmed(false);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const tabs: Array<{ id: Channel; label: string }> = [
    { id: "human_expertise", label: "Record directly" },
    { id: "artifact_upload", label: "From a document" },
    { id: "live_capture", label: "Typed capture" },
  ];
  return (
    <section className="space-y-4 border-y py-4" aria-label="Record a signal">
      <h2 className="label-caps">Record a signal</h2>
      <p className="text-sm text-muted-foreground">
        A signal is evidence that a condition may be worth acting on — a gap, a risk, an opportunity
        — never a solution request. Every attempt is recorded, including blocked and duplicate ones.
      </p>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Intake channel">
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant={channel === t.id ? "default" : "outline"}
            size="sm"
            role="tab"
            aria-selected={channel === t.id}
            onClick={() => {
              setChannel(t.id);
              setDrafts([]);
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>
      {channel === "human_expertise" && (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submitDirect();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="si-condition">Observed condition</Label>
            <Textarea
              id="si-condition"
              required
              maxLength={2000}
              rows={3}
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="What condition did you observe, and for whom?"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="si-population">Affected population</Label>
              <Input
                id="si-population"
                maxLength={500}
                value={population}
                onChange={(e) => setPopulation(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="si-urgency">Urgency</Label>
              <select
                id="si-urgency"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Not recorded</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="si-value">Potential value</Label>
              <Input
                id="si-value"
                maxLength={300}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" disabled={busy || !condition.trim()} className="justify-self-start">
            {busy ? "Recording…" : "Record signal"}
          </Button>
        </form>
      )}
      {channel === "artifact_upload" && (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submitArtifact();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="si-kind">Artifact kind</Label>
            <Input
              id="si-kind"
              required
              maxLength={60}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="si-artifact">Artifact text</Label>
            <Textarea
              id="si-artifact"
              required
              maxLength={20000}
              rows={6}
              value={artifact}
              onChange={(e) => setArtifact(e.target.value)}
              placeholder="Paste the document text. Payment card data is hard-blocked; personal or health identifiers are quarantined before any analysis."
            />
          </div>
          <Button type="submit" disabled={busy || !artifact.trim()} className="justify-self-start">
            {busy ? "Analysing…" : "Propose signals"}
          </Button>
        </form>
      )}
      {channel === "live_capture" && (
        <div className="grid gap-3">
          {!captureId ? (
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void openCapture();
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="si-purpose">Purpose of the capture</Label>
                <Input
                  id="si-purpose"
                  required
                  maxLength={500}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={consentConfirmed}
                  onChange={(e) => setConsentConfirmed(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  I confirm that every participant whose words are captured here has consented to
                  being recorded. This confirmation is stored with the capture.
                </span>
              </label>
              <Button
                type="submit"
                disabled={busy || !purpose.trim() || !consentConfirmed}
                className="justify-self-start"
              >
                {busy ? "Opening…" : "Open capture (consent required)"}
              </Button>
            </form>
          ) : (
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void finishCapture();
              }}
            >
              <p className="text-xs text-muted-foreground">
                Capture <span className="ident">{captureId.slice(0, 8)}</span> open under your
                recorded consent confirmation. Type or paste the captured words below — this channel
                does not record audio.
              </p>
              <div className="space-y-1">
                <Label htmlFor="si-transcript">Captured text</Label>
                <Textarea
                  id="si-transcript"
                  required
                  maxLength={20000}
                  rows={6}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={busy || !transcript.trim()}
                  className="justify-self-start"
                >
                  {busy ? "Analysing…" : "Complete capture"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void dropCapture()}
                >
                  Abandon capture
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
      {drafts.length > 0 && (
        <DraftList drafts={drafts} origin={draftOrigin} onConfirmed={onChanged} />
      )}
    </section>
  );
}

function PromoteControl({
  signalId,
  state,
  onChanged,
}: {
  signalId: string;
  state: string;
  onChanged: () => void;
}) {
  const promote = useServerFn(promoteSignal);
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  if (!PROMOTABLE_STATES.includes(state as never)) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label="Promotion rationale"
        placeholder="Why is this worth a mission?"
        maxLength={1000}
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        className="max-w-xs"
      />
      <Button
        variant="outline"
        size="sm"
        disabled={busy || !rationale.trim()}
        onClick={async () => {
          setBusy(true);
          setResult("");
          try {
            const r = await promote({ data: { signal_id: signalId, rationale } });
            if (r.promoted) {
              toast.success("Signal promoted — it can now originate a mission");
              onChanged();
            } else setResult(r.note ?? "Recorded as a suggestion; state unchanged.");
          } catch (e) {
            toast.error(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Recording…" : "Promote signal"}
      </Button>
      {result && (
        <p role="status" className="text-xs text-muted-foreground">
          {result}
        </p>
      )}
    </div>
  );
}

function LinkControl({
  signalId,
  missions,
  onChanged,
}: {
  signalId: string;
  missions: Array<{ id: string; human_ref: string; title: string }>;
  onChanged: () => void;
}) {
  const link = useServerFn(linkSignalToMission);
  const [mission, setMission] = useState("");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  if (!missions.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Mission to link"
        value={mission}
        onChange={(e) => setMission(e.target.value)}
        className="h-9 max-w-xs rounded-md border bg-background px-2 text-sm"
      >
        <option value="">Select mission</option>
        {missions.map((m) => (
          <option key={m.id} value={m.id}>
            {m.human_ref} · {m.title}
          </option>
        ))}
      </select>
      <Input
        aria-label="Link rationale"
        placeholder="Why does this signal bear on the mission?"
        maxLength={1000}
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        className="max-w-xs"
      />
      <Button
        variant="outline"
        size="sm"
        disabled={busy || !mission || !rationale.trim()}
        onClick={async () => {
          setBusy(true);
          try {
            await link({ data: { signal_id: signalId, mission_id: mission, rationale } });
            toast.success("Secondary signal linked to the mission");
            onChanged();
          } catch (e) {
            toast.error(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Link to mission
      </Button>
    </div>
  );
}

function SignalsPage() {
  const q = useSurface();
  const qc = useQueryClient();
  const [promoting, setPromoting] = useState("");
  const objects = q.data?.objects ?? [];
  const signals = objects.filter((o) => o.type === "ValueSignal");
  const missions = objects.filter((o) => o.type === "ValueMission");
  const promotedFrom = (signalId: string) =>
    missions.find((m) => m.body["signal_ref"] === signalId || m.body["signal_id"] === signalId);
  const changed = () => qc.invalidateQueries({ queryKey: ["human-surface"] });
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-lg">Signal Intake and Register</h1>
      <p className="text-sm text-muted-foreground">
        The starting point of the value flow: signal → mission → cell → burst → framing session. A
        signal may rest here with no mission at all; a mission can only begin from a promoted
        signal.
      </p>
      <IntakePanel onChanged={changed} />
      {q.isLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          Reading permitted signals…
        </p>
      )}
      {q.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorText(q.error)}
        </p>
      )}
      <ul className="divide-y">
        {signals.map((s) => {
          const existing = promotedFrom(s.id);
          return (
            <li key={s.id} className="space-y-2 py-3">
              <Link
                to="/signals/$signalId"
                params={{ signalId: s.id }}
                className="underline underline-offset-4"
              >
                <span className="ident">{s.human_ref}</span> · {s.title}
              </Link>
              <p className="text-sm">{s.statement}</p>
              <p className="text-xs text-muted-foreground">
                {s.lifecycle_state} · origin{" "}
                {String(s.body["origin_channel"] ?? "recorded before intake")} · urgency{" "}
                {String(s.body["urgency"] ?? "not recorded")} · potential value{" "}
                {String(s.body["potential_value"] ?? "not recorded")}
              </p>
              <PromoteControl signalId={s.id} state={s.lifecycle_state} onChanged={changed} />
              {s.lifecycle_state === "promoted" && !existing && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPromoting(promoting === s.id ? "" : s.id)}
                  >
                    {promoting === s.id
                      ? "Close mission form"
                      : "Establish mission from this signal"}
                  </Button>
                  <LinkControl signalId={s.id} missions={missions} onChanged={changed} />
                </>
              )}
              {existing && (
                <p className="text-xs">
                  <Link
                    to="/missions/$missionId"
                    params={{ missionId: existing.id }}
                    className="ident underline"
                  >
                    {existing.human_ref}
                  </Link>{" "}
                  · mission already established from this signal
                </p>
              )}
              {promoting === s.id && !existing && <MissionForm objects={objects} signalId={s.id} />}
            </li>
          );
        })}
      </ul>
      {!q.isLoading && !q.error && signals.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No permitted Value Signals yet. Record the first one above.
        </p>
      )}
    </main>
  );
}
