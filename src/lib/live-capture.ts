/**
 * Live speech capture (browser side). Records microphone PCM with the Web Audio API,
 * encodes complete WAV chunks every few seconds, and uploads them through a durable
 * outbox: chunks are buffered in IndexedDB and retried until the server acknowledges
 * them, so a network drop cannot lose captured speech once it is durably buffered
 * (8A.13). Samples are held in memory until the IndexedDB write succeeds — a storage
 * failure (quota, abort) keeps the audio in memory and retries it with the next
 * window. Only truly silent windows (no audible energy in the samples) are
 * discarded; short or quiet-but-audible speech is always kept.
 */

export interface CaptureChunk {
  id: string;
  /** The signed-in account that captured this chunk; only that account may upload it. */
  accountId: string;
  sessionId: string;
  speakerId: string;
  tOffsetMs: number;
  wav: ArrayBuffer;
  attempts: number;
}

const DB_NAME = "thread-live-capture";
const STORE = "outbox";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function outboxPut(chunk: CaptureChunk): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(chunk);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function outboxDelete(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/**
 * Count buffered chunks. With `accountId`, counts only that account's chunks —
 * a different signed-in account never sees or sends another account's audio.
 */
export async function outboxCount(accountId?: string): Promise<number> {
  if (accountId === undefined) {
    const db = await openDb();
    const n = await new Promise<number>((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return n;
  }
  return (await outboxAll(accountId)).length;
}

export async function outboxAll(accountId?: string): Promise<CaptureChunk[]> {
  const db = await openDb();
  const all = await new Promise<CaptureChunk[]>((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as CaptureChunk[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  if (accountId === undefined) return all;
  return all.filter((c) => c.accountId === accountId);
}

export function encodeWav(chunks: readonly Float32Array[], sampleRate: number): ArrayBuffer {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new ArrayBuffer(44 + length * 2);
  const view = new DataView(bytes);
  const tag = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  tag(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, length * 2, true);
  let offset = 44;
  for (const chunk of chunks)
    for (const value of chunk) {
      const sample = Math.max(-1, Math.min(1, value));
      view.setInt16(offset, sample * (sample < 0 ? 32768 : 32767), true);
      offset += 2;
    }
  return bytes;
}

export function wavToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  const step = 8192;
  for (let i = 0; i < bytes.length; i += step)
    s += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(s);
}

export interface LiveRecorder {
  stop: () => Promise<void>;
}

/**
 * Start capturing microphone audio in `chunkMs` windows. Each finished window is
 * encoded as a complete WAV, persisted to the outbox, and handed to `onChunk`,
 * which must upload it and only resolve when the server has acknowledged it.
 */
export async function startLiveCapture(opts: {
  accountId: string;
  sessionId: string;
  speakerId: string;
  chunkMs?: number;
  onChunk: (chunk: CaptureChunk) => Promise<void>;
  onError?: (message: string) => void;
}): Promise<LiveRecorder> {
  const chunkMs = opts.chunkMs ?? 4000;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new AudioContext();
  await audioContext.resume();
  const source = audioContext.createMediaStreamSource(stream);
  const node = audioContext.createScriptProcessor(4096, 1, 1);
  let current: Float32Array[] = [];
  let windowStart = 0;
  let stopped = false;
  let seq = 0;
  // Flushes are serialized: a window never starts persisting while the previous
  // one is in flight, so the buffer is never cleared under an unfinished write.
  let chain: Promise<void> = Promise.resolve();

  node.onaudioprocess = (event) => {
    if (stopped) return;
    current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  };
  source.connect(node);
  node.connect(audioContext.destination);

  const doFlush = async () => {
    if (!current.length) return;
    const n = current.length;
    const chunks = current.slice(0, n);
    const offset = windowStart;
    windowStart += chunkMs;
    // Silence is detected from the samples, not the byte size: a window with no
    // audible energy carries no speech and is dropped; any audible window is
    // kept however short it is.
    let peak = 0;
    for (const c of chunks)
      for (const v of c) {
        const a = Math.abs(v);
        if (a > peak) peak = a;
      }
    if (peak < 1e-4) {
      current.splice(0, n);
      return;
    }
    const wav = encodeWav(chunks, audioContext.sampleRate);
    const chunk: CaptureChunk = {
      id: `${opts.sessionId}-${Date.now()}-${seq++}`,
      accountId: opts.accountId,
      sessionId: opts.sessionId,
      speakerId: opts.speakerId,
      tOffsetMs: offset,
      wav,
      attempts: 0,
    };
    try {
      await outboxPut(chunk); // durable first
    } catch (e) {
      // Persistence failed (quota, abort, storage): the samples stay in the
      // buffer and are retried with the next window — nothing is cleared.
      opts.onError?.(`buffering failed, audio retained: ${(e as Error).message}`);
      return;
    }
    current.splice(0, n); // clear only after the durable write succeeded
    try {
      await opts.onChunk(chunk);
      await outboxDelete(chunk.id);
    } catch (e) {
      opts.onError?.((e as Error).message);
      // stays in the outbox; flushOutbox retries it
    }
  };
  const flush = () => {
    chain = chain.then(doFlush);
    return chain;
  };

  const timer = window.setInterval(() => {
    void flush();
  }, chunkMs);

  return {
    async stop() {
      if (stopped) return;
      stopped = true;
      window.clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      node.disconnect();
      source.disconnect();
      node.onaudioprocess = null;
      await flush(); // drain in-flight work and the final window
      await audioContext.close();
    },
  };
}

/**
 * Retry the caller's own buffered chunks oldest-first; resolves when that
 * account's outbox is empty. Chunks captured under a different sign-in stay
 * untouched on the device — they are never uploaded under the wrong identity.
 */
export async function flushOutbox(
  onChunk: (chunk: CaptureChunk) => Promise<void>,
  accountId: string,
): Promise<number> {
  const all = (await outboxAll(accountId)).sort((a, b) => a.id.localeCompare(b.id));
  let sent = 0;
  for (const chunk of all) {
    await onChunk(chunk);
    await outboxDelete(chunk.id);
    sent++;
  }
  return sent;
}
