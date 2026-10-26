import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// Binds a sealed blob to this purpose and format version, so bytes sealed for anything else
// with the same key cannot be replayed as a plan.
export const SEAL_AAD = 'ayojan/state/v1';

const KEY_ID_BYTES = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
export const SEAL_OVERHEAD_BYTES = KEY_ID_BYTES + IV_BYTES + TAG_BYTES;

/**
 * One byte derived from the key itself. Rotation is pre-cut (D06), but carrying the id now
 * means a link sealed with another key is refused before any decryption work, and adding a
 * second key later needs no change to the link format.
 */
export function keyIdOf(key: Uint8Array): number {
  return createHash('sha256').update(key).digest()[0] ?? 0;
}

// The key id is part of the authenticated data, so editing that byte is caught as tampering
// rather than steering decryption to a different key.
function associatedData(keyId: number): Buffer {
  return Buffer.concat([Buffer.from(SEAL_AAD, 'utf8'), Buffer.from([keyId])]);
}

/** AES-256-GCM: key id, 12-byte random IV, ciphertext, 16-byte tag, in that order. */
export function seal(plaintext: Uint8Array, key: Uint8Array): Buffer {
  const keyId = keyIdOf(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(associatedData(keyId));
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([Buffer.from([keyId]), iv, body, cipher.getAuthTag()]);
}

export type OpenResult = { ok: true; plaintext: Buffer } | { ok: false; reason: 'tampered' };

/** Never throws: a short blob, a foreign key id, a wrong key and any edited byte all refuse. */
export function open(sealed: Uint8Array, key: Uint8Array): OpenResult {
  const refused = { ok: false, reason: 'tampered' } as const;
  if (sealed.length < SEAL_OVERHEAD_BYTES) return refused;
  const keyId = keyIdOf(key);
  if (sealed[0] !== keyId) return refused;
  const iv = sealed.subarray(KEY_ID_BYTES, KEY_ID_BYTES + IV_BYTES);
  const body = sealed.subarray(KEY_ID_BYTES + IV_BYTES, sealed.length - TAG_BYTES);
  const tag = sealed.subarray(sealed.length - TAG_BYTES);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(associatedData(keyId));
    decipher.setAuthTag(tag);
    return { ok: true, plaintext: Buffer.concat([decipher.update(body), decipher.final()]) };
  } catch {
    return refused;
  }
}
