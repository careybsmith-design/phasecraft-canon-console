/** Transcription contract (Section 3.4). */
export interface Segment { speaker_id: string; t_start: number; t_end: number; text: string; confidence: number }
export interface Transcription {
  startStream(sessionId: string, consentIds: string[]): string;
  pushAudio(streamId: string, chunk: { speaker_id: string; text: string; t_offset_ms: number }): void;
  onSegment(streamId: string, cb: (s: Segment) => void): void;
  finalize(streamId: string): Segment[];
}
