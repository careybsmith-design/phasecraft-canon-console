/**
 * Connection-key encryption (server-only — never import in the browser).
 * AES-256-GCM via Web Crypto so it runs on the edge runtime (workerd).
 * Lovable auto-provisions APP_USER_CONNECTION_KEY_SECRET (base64, 32 bytes).
 */

function keyBytes(): Uint8Array {
  const raw = process.env['APP_USER_CONNECTION_KEY_SECRET'];
  if (!raw) throw new Error("APP_USER_CONNECTION_KEY_SECRET is not set");
  const bin = atob(raw);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", keyBytes() as BufferSource, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptConnectionKey(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importKey();
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  // iv | ciphertext+tag, base64 — one opaque column value.
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.length);
  return toBase64(out);
}

export async function decryptConnectionKey(stored: string): Promise<string> {
  const bin = atob(stored);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const iv = buf.subarray(0, 12);
  const ct = buf.subarray(12);
  const key = await importKey();
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(plain);
}
