// ---------------------------------------------------------------------------
// biometric.ts — Face ID / Touch ID unlock.
//
// Uses a passkey on this phone (WebAuthn platform authenticator) with the
// PRF extension. After a successful Face ID check, the phone returns a secret
// that only this passkey can produce. That secret is turned into an AES key
// which encrypts the PIN on this device. Without Face ID the stored blob is
// useless, and nothing is ever sent over the network.
// ---------------------------------------------------------------------------

import { randomBytes, toArrayBuffer, bytesToBase64, base64ToBytes } from './crypto';
import * as db from './db';
import type { BiometricRecord } from '../types';

const INFO = new TextEncoder().encode('atoll-info-faceid-v1');

export async function biometricAvailable(): Promise<boolean> {
  try {
    const PKC = (window as any).PublicKeyCredential;
    if (!PKC || !PKC.isUserVerifyingPlatformAuthenticatorAvailable) return false;
    return await PKC.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

async function wrapKeyFromPrf(prf: ArrayBuffer): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', prf, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: INFO },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

async function prfFromAssertion(credentialId: Uint8Array, salt: Uint8Array): Promise<ArrayBuffer> {
  const cred: any = await navigator.credentials.get({
    publicKey: {
      challenge: toArrayBuffer(randomBytes(32)),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: toArrayBuffer(credentialId) }],
      userVerification: 'required',
      timeout: 60_000,
      extensions: { prf: { eval: { first: toArrayBuffer(salt) } } } as any,
    },
  });
  const out = cred?.getClientExtensionResults?.()?.prf?.results?.first;
  if (!out) throw new Error('This phone did not return a Face ID key. Update iOS, or keep using your PIN.');
  return out as ArrayBuffer;
}

async function sealPin(pin: string, prf: ArrayBuffer, credentialId: Uint8Array, salt: Uint8Array): Promise<void> {
  const key = await wrapKeyFromPrf(prf);
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, new TextEncoder().encode(pin));
  const rec: BiometricRecord = {
    id: 'biometric', credentialId: bytesToBase64(credentialId), prfSalt: bytesToBase64(salt),
    ct: bytesToBase64(ct), iv: bytesToBase64(iv), createdAt: new Date().toISOString(),
  };
  await db.putBiometric(rec);
}

/**
 * Step 1 of turning Face ID on: create the passkey. Some phones return the
 * secret straight away (done in one scan); otherwise returns a pending
 * credential that needs one more scan via finishEnrollment().
 */
export async function startEnrollment(pin: string): Promise<{ done: true } | { done: false; credentialId: Uint8Array; salt: Uint8Array }> {
  const salt = randomBytes(32);
  const cred: any = await navigator.credentials.create({
    publicKey: {
      challenge: toArrayBuffer(randomBytes(32)),
      rp: { name: 'Atoll Info', id: location.hostname },
      user: { id: toArrayBuffer(randomBytes(16)), name: 'Atoll Info officer', displayName: 'Atoll Info' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
      timeout: 60_000,
      attestation: 'none',
      extensions: { prf: { eval: { first: toArrayBuffer(salt) } } } as any,
    },
  });
  if (!cred) throw new Error('Face ID setup was cancelled.');
  const credentialId = new Uint8Array(cred.rawId);
  const ext = cred.getClientExtensionResults?.()?.prf;
  if (ext && ext.enabled === false) throw new Error('This phone does not support Face ID unlock for web apps. Keep using your PIN.');
  if (ext?.results?.first) {
    await sealPin(pin, ext.results.first, credentialId, salt);
    return { done: true };
  }
  return { done: false, credentialId, salt };
}

export async function finishEnrollment(pin: string, credentialId: Uint8Array, salt: Uint8Array): Promise<void> {
  const prf = await prfFromAssertion(credentialId, salt);
  await sealPin(pin, prf, credentialId, salt);
}

/** Runs Face ID and returns the PIN it protects. */
export async function recoverPin(): Promise<string> {
  const rec = await db.getBiometric();
  if (!rec) throw new Error('Face ID is not set up.');
  const prf = await prfFromAssertion(base64ToBytes(rec.credentialId), base64ToBytes(rec.prfSalt));
  const key = await wrapKeyFromPrf(prf);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(rec.iv)) }, key, toArrayBuffer(base64ToBytes(rec.ct)),
  );
  return new TextDecoder().decode(plain);
}
