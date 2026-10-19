import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liveTranscription, transcribeAudio, LIVE_TRANSCRIBE_MODEL } from "./live.server";
import { encryptConnectionKey, decryptConnectionKey } from "@/server/connectionKeyCrypto";

const WAV = new Uint8Array(2048).fill(1);

function sseResponse(frames: string[]): Response {
  const body = frames.map((f) => `data: ${f}\n\n`).join("");
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

describe("live transcription adapter", () => {
  beforeEach(() => {
    process.env["LOVABLE_API_KEY"] = "test-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["LOVABLE_API_KEY"];
  });

  it("accumulates streamed deltas and prefers the final done text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          JSON.stringify({ type: "transcript.text.delta", delta: "We need " }),
          JSON.stringify({ type: "transcript.text.delta", delta: "faster claims." }),
          JSON.stringify({
            type: "transcript.text.done",
            text: "We need faster claims.",
            usage: { seconds: 4 },
          }),
        ]),
      ),
    );
    const out = await transcribeAudio(WAV);
    expect(out.text).toBe("We need faster claims.");
    expect(out.model).toBe(LIVE_TRANSCRIBE_MODEL);
    expect(out.seconds).toBe(4);
  });

  it("sends the multipart contract: model, wav file, streaming", async () => {
    const spy = vi.fn(async () =>
      sseResponse([JSON.stringify({ type: "transcript.text.done", text: "hi" })]),
    );
    vi.stubGlobal("fetch", spy);
    await transcribeAudio(WAV, { language: "en" });
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ai.gateway.lovable.dev/v1/audio/transcriptions");
    const form = init.body as FormData;
    expect(form.get("model")).toBe(LIVE_TRANSCRIBE_MODEL);
    expect(form.get("stream")).toBe("true");
    expect(form.get("language")).toBe("en");
    expect((form.get("file") as File).type).toBe("audio/wav");
  });

  it("surfaces the gateway's safe error message and never retries 402/403", async () => {
    const spy = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "insufficient credits" }), { status: 402 }),
    );
    vi.stubGlobal("fetch", spy);
    await expect(transcribeAudio(WAV)).rejects.toThrow(/insufficient credits/);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("rejects empty or oversized audio before calling the gateway", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    await expect(transcribeAudio(new Uint8Array(0))).rejects.toThrow(/INVALID_AUDIO/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("throws when no speech is recognised", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([JSON.stringify({ type: "transcript.text.done", text: "  " })]),
      ),
    );
    await expect(transcribeAudio(WAV)).rejects.toThrow(/TRANSCRIPTION_EMPTY/);
  });

  it("adapter: requires consent, transcribes chunks, segments with timestamps", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          JSON.stringify({
            type: "transcript.text.done",
            text: "We need faster claims. Claims must stay audited.",
          }),
        ]),
      ),
    );
    const tr = liveTranscription();
    expect(() => tr.startStream("s1", [])).toThrow(/CONSENT_REQUIRED/);
    const sid = tr.startStream("s1", ["c1"]);
    const seen: string[] = [];
    tr.onSegment(sid, (s) => seen.push(s.text));
    const segs = await tr.pushAudioChunk(sid, { speaker_id: "p1", wav: WAV, t_offset_ms: 1000 });
    expect(segs.length).toBe(2);
    expect(segs[0]!.speaker_id).toBe("p1");
    expect(segs[0]!.t_start).toBeGreaterThanOrEqual(1000);
    expect(segs[1]!.t_start).toBeGreaterThan(segs[0]!.t_start);
    expect(seen).toHaveLength(2);
    expect(tr.finalize(sid)).toHaveLength(2);
  });
});

describe("connection key crypto", () => {
  beforeEach(() => {
    process.env["APP_USER_CONNECTION_KEY_SECRET"] = btoa("0123456789abcdef0123456789abcdef");
  });
  afterEach(() => delete process.env["APP_USER_CONNECTION_KEY_SECRET"]);

  it("round-trips and stores opaque ciphertext", async () => {
    const key = "lovack_test_123";
    const enc = await encryptConnectionKey(key);
    expect(enc).not.toContain(key);
    expect(await decryptConnectionKey(enc)).toBe(key);
  });

  it("produces different ciphertext each time (random IV)", async () => {
    const a = await encryptConnectionKey("lovack_x");
    const b = await encryptConnectionKey("lovack_x");
    expect(a).not.toBe(b);
  });
});
