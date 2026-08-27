// ---------------------------------------------------------------------------
// crypto.ts
//
// Every record is encrypted with AES-GCM using a key derived from the
// officer's PIN via PBKDF2-SHA256. The key never leaves memory, is never
// written to disk, and is never sent anywhere — this file performs no
// network I/O of any kind.
// ---------------------------------------------------------------------------

const PBKDF2_ITERATIONS = 250_000;

export function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(view.byteLength);
  new Uint8Array(buf).set(view);
  return buf;
}

export function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

export function bytesToBase64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < u8.byteLength; i++) binary += String.fromCharCode(u8[i]);
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function deriveKey(pin: string, saltBytes: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toArrayBuffer(saltBytes), iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable — cannot be exported out of Web Crypto by any application code
    ['encrypt', 'decrypt']
  );
}

export async function createNewKeyMaterial(pin: string) {
  const saltBytes = randomBytes(16);
  const iterations = PBKDF2_ITERATIONS;
  const key = await deriveKey(pin, saltBytes, iterations);
  return { key, saltBytes, iterations };
}

interface EncryptedPayload {
  ciphertext: ArrayBuffer;
  iv: ArrayBuffer;
}

async function encryptString(key: CryptoKey, plaintext: string): Promise<EncryptedPayload> {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, new TextEncoder().encode(plaintext));
  return { ciphertext, iv: toArrayBuffer(iv) };
}

async function decryptToString(key: CryptoKey, payload: EncryptedPayload): Promise<string> {
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: payload.iv }, key, payload.ciphertext);
  return new TextDecoder().decode(plainBuf);
}

export async function encryptJSON(key: CryptoKey, value: unknown): Promise<{ ct: string; iv: string }> {
  const { ciphertext, iv } = await encryptString(key, JSON.stringify(value));
  return { ct: bytesToBase64(ciphertext), iv: bytesToBase64(iv) };
}

export async function decryptJSON<T>(key: CryptoKey, ct: string, iv: string): Promise<T> {
  const plaintext = await decryptToString(key, { ciphertext: toArrayBuffer(base64ToBytes(ct)), iv: toArrayBuffer(base64ToBytes(iv)) });
  return JSON.parse(plaintext) as T;
}

/** A "verifier" lets us test a PIN without ever storing the PIN itself: encrypt a known constant, and see if decrypting it later succeeds. */
export async function createVerifier(key: CryptoKey) {
  return encryptJSON(key, { check: 'ATOLL-DIMS-OK' });
}

export async function testVerifier(key: CryptoKey, ct: string, iv: string): Promise<boolean> {
  try {
    const result = await decryptJSON<{ check: string }>(key, ct, iv);
    return result.check === 'ATOLL-DIMS-OK';
  } catch {
    return false;
  }
}
