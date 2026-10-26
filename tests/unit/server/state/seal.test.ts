import { createCipheriv, randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { keyIdOf, open, seal, SEAL_AAD, SEAL_OVERHEAD_BYTES } from '@/server/state/seal';

const KEY = Buffer.alloc(32, 7);
const PLAINTEXT = Buffer.from('{"schema":1,"ops":[]}', 'utf8');

function flipped(blob: Buffer, index: number): Buffer {
  const copy = Buffer.from(blob);
  copy[index] = (copy[index] ?? 0) ^ 0x01;
  return copy;
}

// A wrong key usually differs in its key-id byte and is refused before GCM runs; this one
// shares the id, so the test exercises the authentication tag itself.
function wrongKeyWithSameId(): Buffer {
  for (;;) {
    const candidate = randomBytes(32);
    if (keyIdOf(candidate) === keyIdOf(KEY) && !candidate.equals(KEY)) return candidate;
  }
}

describe('seal and open', () => {
  it('round-trips the plaintext', () => {
    const opened = open(seal(PLAINTEXT, KEY), KEY);
    expect(opened).toEqual({ ok: true, plaintext: PLAINTEXT });
  });

  it('lays out key id, IV, ciphertext and tag', () => {
    const blob = seal(PLAINTEXT, KEY);
    expect(blob.length).toBe(PLAINTEXT.length + SEAL_OVERHEAD_BYTES);
    expect(blob[0]).toBe(keyIdOf(KEY));
  });

  it('uses a fresh IV every time: 1,000 seals give 1,000 distinct IVs', () => {
    const ivs = new Set<string>();
    for (let i = 0; i < 1_000; i += 1)
      ivs.add(seal(PLAINTEXT, KEY).subarray(1, 13).toString('hex'));
    expect(ivs.size).toBe(1_000);
  });

  it.each([
    { region: 'key id', index: () => 0 },
    { region: 'IV', index: () => 5 },
    { region: 'ciphertext', index: () => 14 },
    { region: 'tag', index: (blob: Buffer) => blob.length - 3 },
  ])('refuses a flipped byte in the $region', ({ index }) => {
    const blob = seal(PLAINTEXT, KEY);
    expect(open(flipped(blob, index(blob)), KEY)).toEqual({ ok: false, reason: 'tampered' });
  });

  it('refuses a wrong key, whether or not its key id matches', () => {
    const blob = seal(PLAINTEXT, KEY);
    expect(open(blob, Buffer.alloc(32, 9))).toEqual({ ok: false, reason: 'tampered' });
    expect(open(blob, wrongKeyWithSameId())).toEqual({ ok: false, reason: 'tampered' });
  });

  it('refuses a blob sealed with the right key under different associated data', () => {
    const keyId = keyIdOf(KEY);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', KEY, iv, { authTagLength: 16 });
    cipher.setAAD(Buffer.concat([Buffer.from('ayojan/other/v1', 'utf8'), Buffer.from([keyId])]));
    const body = Buffer.concat([cipher.update(PLAINTEXT), cipher.final()]);
    const forged = Buffer.concat([Buffer.from([keyId]), iv, body, cipher.getAuthTag()]);
    expect(SEAL_AAD).toBe('ayojan/state/v1');
    expect(open(forged, KEY)).toEqual({ ok: false, reason: 'tampered' });
  });

  it('refuses a blob shorter than the overhead and an empty key without throwing', () => {
    expect(open(Buffer.alloc(SEAL_OVERHEAD_BYTES - 1), KEY)).toEqual({
      ok: false,
      reason: 'tampered',
    });
    expect(open(seal(PLAINTEXT, KEY), new Uint8Array(0))).toEqual({
      ok: false,
      reason: 'tampered',
    });
  });
});
