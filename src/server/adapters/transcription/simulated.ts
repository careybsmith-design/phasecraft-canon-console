/**
 * Simulated Transcription adapter: deterministic. The "audio" chunk is the spoken words as typed by the
 * Builder; diarisation comes from the chosen speaker; timing is 330 ms per word from the chunk offset.
 * Everything it produces is marked simulated (Section 3.4).
 */
import type { Segment, Transcription } from "./contract";
import { segment } from "@/domain/framing";

export function simulatedTranscription(): Transcription {
  const streams = new Map<string, { segments: Segment[]; cbs: Array<(s: Segment) => void> }>();
  let n = 0;
  return {
    startStream(sessionId, consentIds) {
      if (!consentIds.length) throw new Error("CONSENT_REQUIRED: no consent, no stream");
      const id = `sim-${sessionId}-${++n}`;
      streams.set(id, { segments: [], cbs: [] });
      return id;
    },
    pushAudio(streamId, chunk) {
      const s = streams.get(streamId);
      if (!s) throw new Error("STREAM_NOT_FOUND");
      for (const u of segment(chunk.text)) {
        const before = chunk.text.slice(0, u.start).split(/\s+/).filter(Boolean).length;
        const words = u.text.split(/\s+/).filter(Boolean).length;
        const seg: Segment = { speaker_id: chunk.speaker_id, t_start: chunk.t_offset_ms + before * 330, t_end: chunk.t_offset_ms + (before + words) * 330, text: u.text, confidence: 0.99 };
        s.segments.push(seg);
        s.cbs.forEach((cb) => cb(seg));
      }
    },
    onSegment(streamId, cb) { streams.get(streamId)?.cbs.push(cb); },
    finalize(streamId) { const s = streams.get(streamId); streams.delete(streamId); return s?.segments ?? []; },
  };
}
