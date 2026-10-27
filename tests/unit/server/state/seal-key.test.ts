import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadSealKey, SEAL_KEY_VARIABLE, SealKeyError } from '@/server/state/seal-key';

const VALID = Buffer.alloc(32, 3).toString('base64');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadSealKey', () => {
  it('decodes one base64 value of 32 bytes', () => {
    expect(loadSealKey({ STATE_SEAL_KEY: VALID })).toEqual(Buffer.alloc(32, 3));
    expect(loadSealKey({ STATE_SEAL_KEY: ` ${VALID}\n` })).toEqual(Buffer.alloc(32, 3));
  });

  it('fails at first use in production when the key is missing, naming the variable', () => {
    const load = () => loadSealKey({ NODE_ENV: 'production' });
    expect(load).toThrow(SealKeyError);
    expect(load).toThrow(SEAL_KEY_VARIABLE);
  });

  it.each([
    { name: '16 bytes', value: Buffer.alloc(16, 1).toString('base64') },
    { name: '33 bytes', value: Buffer.alloc(33, 1).toString('base64') },
    { name: 'not base64', value: 'SENTINEL-VALUE!*' },
  ])('refuses a key of $name without echoing it', ({ value }) => {
    let message = '';
    try {
      loadSealKey({ STATE_SEAL_KEY: value, NODE_ENV: 'production' });
    } catch (error) {
      expect(error).toBeInstanceOf(SealKeyError);
      message = (error as Error).message;
    }
    expect(message).toContain(SEAL_KEY_VARIABLE);
    expect(message).not.toContain(value);
  });

  it('uses one ephemeral key per process in development, with a warning', () => {
    Reflect.deleteProperty(globalThis, '__ayojanEphemeralSealKey');
    const warn = vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined);
    const first = loadSealKey({ NODE_ENV: 'development' });
    const second = loadSealKey({});
    expect(first).toHaveLength(32);
    expect(second).toBe(first);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
