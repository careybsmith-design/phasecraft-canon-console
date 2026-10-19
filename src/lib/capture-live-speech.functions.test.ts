/**
 * W2.1: live speech audio must never leave for transcription before session
 * access, capture state, speaker identity and audio consent are verified.
 * These tests prove the guards run first by asserting the transcription
 * adapter is never called when a guard fails.
 */
import { describe, expect, it, vi } from "vitest";
import { captureLiveSpeech } from "./framing.functions";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: vi.fn() }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

const fake = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: fake }));

const transcribeAudio = vi.hoisted(() => vi.fn());
vi.mock("@/server/adapters/transcription/live.server", () => ({ transcribeAudio }));

const caller = "11111111-1111-4111-8111-111111111111";
const otherUser = "99999999-9999-4999-8999-999999999999";
const sessionId = "22222222-2222-4222-8222-222222222222";
const speakerId = "33333333-3333-4333-8333-333333333333";

const input = {
  session_id: sessionId,
  speaker_id: speakerId,
  audio_wav_base64: Buffer.from("RIFF....WAVEfmt fake-audio-bytes").toString("base64"),
  t_offset_ms: 0,
};

type Handler = (args: {
  data: typeof input;
  context: { userId: string };
}) => Promise<unknown>;

function mockDb(opts: {
  state?: string;
  speakerUserId?: string | null;
  consents?: Array<{ id: string }>;
}) {
  const session = {
    id: sessionId,
    type: "FramingSession",
    owner_id: caller,
    human_ref: "FS-1",
    lifecycle_state: opts.state ?? "capturing",
    body: {
      participants: [
        {
          id: speakerId,
          user_id: opts.speakerUserId === undefined ? caller : opts.speakerUserId,
          name: "Speaker",
          decision_authority: false,
        },
      ],
    },
  };
  fake.from.mockImplementation((table: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.select = self;
    chain.eq = self;
    chain.is = self;
    chain.limit = async () => ({ data: [], error: null });
    chain.contains = async () => ({ data: opts.consents ?? [], error: null });
    chain.maybeSingle = async () => ({
      data: table === "objects" ? session : null,
      error: null,
    });
    return chain;
  });
}

describe("captureLiveSpeech pre-transcription guards", () => {
  it("rejects when the session is not capturing, without transcribing", async () => {
    mockDb({ state: "planned", consents: [{ id: "c1" }] });
    transcribeAudio.mockClear();
    await expect(
      (captureLiveSpeech as unknown as Handler)({ data: input, context: { userId: caller } }),
    ).rejects.toThrow(/CAPTURE_NOT_OPEN/);
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it("rejects when the speaker has no active audio consent, without transcribing", async () => {
    mockDb({ consents: [] });
    transcribeAudio.mockClear();
    await expect(
      (captureLiveSpeech as unknown as Handler)({ data: input, context: { userId: caller } }),
    ).rejects.toThrow(/CONSENT_REQUIRED/);
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it("rejects when the speaker is a different account's participant, without transcribing", async () => {
    mockDb({ speakerUserId: otherUser, consents: [{ id: "c1" }] });
    transcribeAudio.mockClear();
    await expect(
      (captureLiveSpeech as unknown as Handler)({ data: input, context: { userId: caller } }),
    ).rejects.toThrow(/SPEAKER_IDENTITY/);
    expect(transcribeAudio).not.toHaveBeenCalled();
  });
});
