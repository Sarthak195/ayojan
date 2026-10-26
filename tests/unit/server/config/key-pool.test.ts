import { describe, expect, it } from 'vitest';

import { loadKeyPool } from '@/server/config/key-pool';

describe('loadKeyPool', () => {
  it.each([
    { name: 'no variables', env: {}, keys: [] },
    { name: 'an empty variable', env: { GEMINI_API_KEY: '' }, keys: [] },
    { name: 'only separators', env: { GEMINI_API_KEY: ' , ,\n' }, keys: [] },
    { name: 'a single key', env: { GEMINI_API_KEY: 'fake-one' }, keys: ['fake-one'] },
    {
      name: 'a comma list',
      env: { GEMINI_API_KEY: 'fake-one,fake-two,fake-three' },
      keys: ['fake-one', 'fake-two', 'fake-three'],
    },
    {
      name: 'a comma list with spaces',
      env: { GEMINI_API_KEY: 'fake-one, fake-two' },
      keys: ['fake-one', 'fake-two'],
    },
    {
      name: 'a whitespace and newline list',
      env: { GEMINI_API_KEY: 'fake-one fake-two\nfake-three\t' },
      keys: ['fake-one', 'fake-two', 'fake-three'],
    },
    {
      name: 'duplicates within the list',
      env: { GEMINI_API_KEY: 'fake-one,fake-two,fake-one' },
      keys: ['fake-one', 'fake-two'],
    },
    {
      name: 'extra numbered variables',
      env: {
        GEMINI_API_KEY: 'fake-one',
        GEMINI_API_KEY_2: 'fake-two',
        GEMINI_API_KEY_3: 'fake-three',
      },
      keys: ['fake-one', 'fake-two', 'fake-three'],
    },
    {
      name: 'a numbered variable without the base variable',
      env: { GEMINI_API_KEY_2: 'fake-two' },
      keys: ['fake-two'],
    },
    {
      name: 'a key repeated across variables',
      env: { GEMINI_API_KEY: 'fake-one,fake-two', GEMINI_API_KEY_2: 'fake-two fake-three' },
      keys: ['fake-one', 'fake-two', 'fake-three'],
    },
    {
      name: 'a key in the newer AQ. format, unchecked',
      env: { GEMINI_API_KEY: 'AQ.fake-new-format' },
      keys: ['AQ.fake-new-format'],
    },
    {
      name: 'unrelated variables',
      env: { GEMINI_MODEL: 'fake-model', OTHER_API_KEY: 'fake-other', GEMINI_API_KEY: 'fake-one' },
      keys: ['fake-one'],
    },
  ])('reads $name', ({ env, keys }) => {
    const pool = loadKeyPool(env);
    expect(pool.keys).toEqual(keys);
    expect(pool.count).toBe(keys.length);
  });

  it('reads the environment on each call, not at module load', () => {
    const env: Record<string, string | undefined> = {};
    expect(loadKeyPool(env).count).toBe(0);
    env.GEMINI_API_KEY = 'fake-late';
    expect(loadKeyPool(env).count).toBe(1);
  });
});
