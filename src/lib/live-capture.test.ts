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
