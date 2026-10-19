/**
 * W2.4: the durable capture outbox is scoped to the signed-in account. Chunks
 * buffered under one account are never counted, listed or uploaded under
 * another account's identity.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { flushOutbox, outboxAll, outboxCount, type CaptureChunk } from "./live-capture";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function chunk(id: string, accountId: string): CaptureChunk {
  return {
    id,
    accountId,
    sessionId: "s1",
    speakerId: "p1",
    tOffsetMs: 0,
    wav: new ArrayBuffer(8),
    attempts: 0,
  };
}

async function put(c: CaptureChunk): Promise<void> {
  const db: IDBDatabase = await new Promise((resolve, reject) => {
    const req = indexedDB.open("thread-live-capture", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("outbox", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("outbox", "readwrite");
    tx.objectStore("outbox").put(c);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

describe("live capture outbox account scoping", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("thread-live-capture");
    await new Promise((r) => setTimeout(r, 0));
  });

  it("counts and lists only the caller's own chunks", async () => {
    await put(chunk("a-1", A));
    await put(chunk("b-1", B));
    expect(await outboxCount(A)).toBe(1);
    expect(await outboxCount(B)).toBe(1);
    expect(await outboxCount()).toBe(2);
    expect((await outboxAll(A)).map((c) => c.id)).toEqual(["a-1"]);
  });

  it("flushOutbox delivers only the caller's chunks and leaves the other account's untouched", async () => {
    await put(chunk("a-1", A));
    await put(chunk("b-1", B));
    const sent: string[] = [];
    const n = await flushOutbox(async (c) => {
      sent.push(c.id);
    }, A);
    expect(n).toBe(1);
    expect(sent).toEqual(["a-1"]);
    expect(await outboxCount(A)).toBe(0);
    expect(await outboxCount(B)).toBe(1);
  });

  it("a failed delivery keeps the chunk buffered for retry", async () => {
    await put(chunk("a-1", A));
    await expect(
      flushOutbox(async () => {
        throw new Error("network down");
      }, A),
    ).rejects.toThrow("network down");
    expect(await outboxCount(A)).toBe(1);
    void vi.fn(); // keep vi import used for future async stubs
  });
});

/**
 * W3.1: the zero-loss claim. Samples are cleared only after a durable IndexedDB
 * write; a persistence failure retains them for the next window; short but
 * audible speech is kept; only truly silent windows are dropped.
 */
import { startLiveCapture } from "./live-capture";

let lastNode: {
  onaudioprocess: ((e: { inputBuffer: { getChannelData(): Float32Array } }) => void) | null;
  connect(): void;
  disconnect(): void;
};

class FakeAudioContext {
  sampleRate = 8000;
  destination = {};
  createMediaStreamSource() {
    return { connect() {}, disconnect() {} };
  }
  createScriptProcessor() {
    lastNode = { onaudioprocess: null, connect() {}, disconnect() {} };
    return lastNode;
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}

function fakeMedia() {
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }),
    },
  });
  vi.stubGlobal("AudioContext", FakeAudioContext);
}

function pushSamples(samples: number[]) {
  lastNode.onaudioprocess?.({
    inputBuffer: { getChannelData: () => new Float32Array(samples) },
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("live capture zero-loss (W3.1)", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("thread-live-capture");
    await wait(0);
    fakeMedia();
  });

  it("a failed IndexedDB write retains the audio and the next window retries it", async () => {
    const realOpen = indexedDB.open.bind(indexedDB);
    let failing = true;
    indexedDB.open = ((...args: Parameters<typeof indexedDB.open>) => {
      if (failing) {
        const req = {} as IDBOpenDBRequest;
        setTimeout(() => {
          (req as { error: DOMException }).error = new DOMException("quota", "QuotaExceededError");
          req.onerror?.({} as Event);
        }, 0);
        return req;
      }
      return realOpen(...args);
    }) as typeof indexedDB.open;

    const uploaded: CaptureChunk[] = [];
    const errors: string[] = [];
    const rec = await startLiveCapture({
      accountId: A,
      sessionId: "s1",
      speakerId: "p1",
      chunkMs: 30,
      onChunk: async (c) => {
        uploaded.push(c);
      },
      onError: (m) => errors.push(m),
    });
    pushSamples([0.5, -0.5, 0.25]);
    await wait(70); // first flush fails on the durable write
    expect(errors.some((m) => m.includes("audio retained"))).toBe(true);
    expect(uploaded).toHaveLength(0);
    indexedDB.open = realOpen;
    await wait(80); // next window retries the retained samples
    await rec.stop();
    expect(uploaded.length).toBeGreaterThanOrEqual(1);
    expect(await outboxCount(A)).toBe(0);
  });

  it("a short audible window under 2048 bytes is kept, not discarded", async () => {
    const uploaded: CaptureChunk[] = [];
    const rec = await startLiveCapture({
      accountId: A,
      sessionId: "s1",
      speakerId: "p1",
      chunkMs: 30,
      onChunk: async (c) => {
        uploaded.push(c);
      },
    });
    pushSamples([0.2]); // 46-byte WAV — short but audible
    await wait(70);
    await rec.stop();
    expect(uploaded.length).toBeGreaterThanOrEqual(1);
  });

  it("a truly silent window carries no speech and is dropped", async () => {
    const uploaded: CaptureChunk[] = [];
    const rec = await startLiveCapture({
      accountId: A,
      sessionId: "s1",
      speakerId: "p1",
      chunkMs: 30,
      onChunk: async (c) => {
        uploaded.push(c);
      },
    });
    pushSamples([0, 0, 0, 0]);
    await wait(70);
    await rec.stop();
    expect(uploaded).toHaveLength(0);
    expect(await outboxCount(A)).toBe(0);
  });
});
