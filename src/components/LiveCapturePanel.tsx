/**
 * Live speech capture panel (8A.2 live speech). Records the microphone in WAV
 * chunks, transcribes through the live Whisper-class adapter server-side, and
 * feeds the standard consent-gated extraction pipeline. Chunks are buffered on
 * this device until the server acknowledges them (8A.13 zero loss).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, Square, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { captureLiveSpeech } from "@/lib/framing.functions";
import {
  flushOutbox,
  outboxCount,
  startLiveCapture,
  wavToBase64,
  type CaptureChunk,
  type LiveRecorder,
} from "@/lib/live-capture";
import type { Participant } from "@/domain/framing";

function errText(e: unknown): string {
  try {
    const m = JSON.parse((e as Error).message) as { explanation?: string };
    return m.explanation ?? (e as Error).message;
  } catch {
    return (e as Error).message;
  }
}

export function LiveCapturePanel({
  sessionId,
  participants,
  openedAt,
  me,
  onDone,
}: {
  sessionId: string;
  participants: Participant[];
  openedAt: string | null;
  me: string;
  onDone: () => void;
}) {
  const send = useServerFn(captureLiveSpeech);
  const [speaker, setSpeaker] = useState(participants[0]?.id ?? "");
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(0);
  const [heldForOthers, setHeldForOthers] = useState(0);
  const [busy, setBusy] = useState(false);
  const recorder = useRef<LiveRecorder | null>(null);
  const startedAt = useRef<number>(0);
  const offset = () =>
    Math.max(0, Date.now() - (openedAt ? Date.parse(openedAt) : startedAt.current));

  const upload = useCallback(
    async (chunk: CaptureChunk) => {
      const r = await send({
        data: {
          session_id: chunk.sessionId,
          speaker_id: chunk.speakerId,
          audio_wav_base64: wavToBase64(chunk.wav),
          t_offset_ms: chunk.tOffsetMs,
          client_id: chunk.id,
        },
      });
      if (r.blocked) toast.error("Blocked by the content-tier gate. Nothing was stored.");
      else onDone();
    },
    [send, onDone],
  );

  const refreshPending = useCallback(async () => setPending(await outboxCount()), []);
  useEffect(() => {
    void refreshPending();
    const t = setInterval(() => void refreshPending(), 5000);
    return () => clearInterval(t);
  }, [refreshPending]);

  const retryOutbox = async () => {
    setBusy(true);
    try {
      const n = await flushOutbox(upload);
      if (n) toast.success(`Delivered ${n} buffered chunk(s)`);
      await refreshPending();
      onDone();
    } catch (e) {
      toast.error(`Still buffered on this device: ${errText(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (!speaker) {
      toast.error("Choose who is speaking first");
      return;
    }
    try {
      startedAt.current = Date.now();
      recorder.current = await startLiveCapture({
        sessionId,
        speakerId: speaker,
        onChunk: async (chunk) => {
          await upload(chunk);
          await refreshPending();
        },
        onError: (m) => toast.error(m),
      });
      setRecording(true);
    } catch (e) {
      toast.error(`Microphone unavailable: ${errText(e)}`);
    }
  };

  const stop = async () => {
    await recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
    await refreshPending();
    onDone();
  };

  return (
    <section className="space-y-2 rounded-md border bg-panel p-3" aria-label="Live speech capture">
      <h2 className="label-caps">Live speech capture</h2>
      <p className="text-xs text-muted-foreground">
        Real transcription through the live adapter. Each participant captures from their own
        signed-in device — the speaker is who you select, never guessed from audio.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Speaker for live capture"
          className="h-8 rounded border bg-background px-2 text-sm"
          value={speaker}
          onChange={(e) => setSpeaker(e.target.value)}
          disabled={recording}
        >
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.decision_authority ? " ★" : ""}
            </option>
          ))}
        </select>
        {!recording ? (
          <Button size="sm" onClick={() => void start()} disabled={!participants.length}>
            <Mic aria-hidden="true" /> Start live capture
          </Button>
        ) : (
          <Button size="sm" variant="destructive" onClick={() => void stop()}>
            <Square aria-hidden="true" /> Stop
          </Button>
        )}
        {pending > 0 && (
          <Button size="sm" variant="outline" onClick={() => void retryOutbox()} disabled={busy}>
            <UploadCloud aria-hidden="true" /> {pending} buffered — retry
          </Button>
        )}
      </div>
      {recording && (
        <p role="status" className="text-xs text-ok">
          Recording — speech appears in the transcript a few seconds after it is spoken.
        </p>
      )}
    </section>
  );
}
