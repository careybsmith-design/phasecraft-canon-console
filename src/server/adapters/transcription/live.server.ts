/**
 * Live Transcription adapter (Section 3.4): real speech-to-text through the Lovable AI
 * gateway's Whisper-class transcription model (`openai/gpt-transcribe`). Server-only.
 *
 * The gateway serves no speaker diarisation: speaker identity comes from the
 * authenticated participant whose device captured the audio (P13), never guessed.
 * Everything it produces is marked live (adapter "Transcription.live").
 */
import type { Segment, Transcription } from "./contract";
import { segment } from "@/domain/framing";

export const LIVE_TRANSCRIBE_MODEL = "openai/gpt-transcribe";
const GATEWAY_BASE = "https://ai.gateway.lovable.dev/v1";
/** gpt-transcribe accepts up to 25 MB; keep chunks well under that. */
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

export interface LiveTranscript {
  text: string;
  model: string;
  seconds: number | null;
}

/**
 * Transcribe one complete WAV clip. Streams the gateway response (SSE) and
 * returns the accumulated transcript. Errors surface the gateway's safe message.
 */
export async function transcribeAudio(
  wav: Uint8Array,
  opts: { language?: string; prompt?: string } = {},
): Promise<LiveTranscript> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("TRANSCRIPTION_UNAVAILABLE: LOVABLE_API_KEY is not set");
  if (!wav.length || wav.length > MAX_AUDIO_BYTES)
    throw new Error("INVALID_AUDIO: empty or oversized audio chunk");

  const form = new FormData();
  form.append("model", LIVE_TRANSCRIBE_MODEL);
  form.append("file", new File([wav as unknown as BlobPart], "chunk.wav", { type: "audio/wav" }));
  form.append("response_format", "json");
  form.append("stream", "true");
  if (opts.language) form.append("language", opts.language);
  if (opts.prompt) form.append("prompt", opts.prompt);

  const res = await fetch(`${GATEWAY_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Transcription gateway failed [${res.status}]: ${body}`);
    let message = `Transcription failed (${res.status})`;
    try {
      const parsed = JSON.parse(body) as { message?: string; error?: { message?: string } };
      message = parsed.message ?? parsed.error?.message ?? message;
    } catch {
      /* keep generic message */
    }
    throw new Error(`TRANSCRIPTION_FAILED: ${message}`);
  }

  // SSE stream: transcript.text.delta events accumulate; transcript.text.done is final.
  let text = "";
  let seconds: number | null = null;
  const reader = res.body?.getReader();
  if (!reader) throw new Error("TRANSCRIPTION_FAILED: empty gateway response");
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const dataLines = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim());
      for (const dl of dataLines) {
        if (!dl || dl === "[DONE]") continue;
        try {
          const ev = JSON.parse(dl) as {
            type?: string;
            delta?: string;
            text?: string;
            usage?: { seconds?: number };
          };
          if (ev.type === "transcript.text.delta" && typeof ev.delta === "string")
            text += ev.delta;
          else if (ev.type === "transcript.text.done") {
            if (typeof ev.text === "string") text = ev.text;
            seconds = ev.usage?.seconds ?? seconds;
          }
        } catch {
          /* ignore malformed frame */
        }
      }
    }
  }
  if (!text.trim()) throw new Error("TRANSCRIPTION_EMPTY: no speech recognised in this chunk");
  return { text: text.trim(), model: LIVE_TRANSCRIBE_MODEL, seconds };
}

/**
 * Live Transcription adapter implementing the Section 3.4 contract. `pushAudio`
 * transcribes the WAV chunk (base64) through the gateway, then segments the
 * transcript with the same deterministic segmenter as the simulated adapter.
 */
export function liveTranscription(): Transcription & {
  pushAudioChunk(
    streamId: string,
    chunk: { speaker_id: string; wav: Uint8Array; t_offset_ms: number },
  ): Promise<Segment[]>;
} {
  const streams = new Map<string, { segments: Segment[]; cbs: Array<(s: Segment) => void> }>();
  let n = 0;
  return {
    startStream(sessionId, consentIds) {
      if (!consentIds.length) throw new Error("CONSENT_REQUIRED: no consent, no stream");
      const id = `live-${sessionId}-${++n}`;
      streams.set(id, { segments: [], cbs: [] });
      return id;
    },
    pushAudio() {
      throw new Error("LIVE_ADAPTER: use pushAudioChunk with WAV audio");
    },
    async pushAudioChunk(streamId, chunk) {
      const s = streams.get(streamId);
      if (!s) throw new Error("STREAM_NOT_FOUND");
      const t = await transcribeAudio(chunk.wav);
      const made: Segment[] = [];
      for (const u of segment(t.text)) {
        const before = t.text.slice(0, u.start).split(/\s+/).filter(Boolean).length;
        const words = u.text.split(/\s+/).filter(Boolean).length;
        const seg: Segment = {
          speaker_id: chunk.speaker_id,
          t_start: chunk.t_offset_ms + before * 330,
          t_end: chunk.t_offset_ms + (before + words) * 330,
          text: u.text,
          confidence: 0.9,
        };
        s.segments.push(seg);
        s.cbs.forEach((cb) => cb(seg));
        made.push(seg);
      }
      return made;
    },
    onSegment(streamId, cb) {
      streams.get(streamId)?.cbs.push(cb);
    },
    finalize(streamId) {
      const s = streams.get(streamId);
      streams.delete(streamId);
      return s?.segments ?? [];
    },
  };
}
