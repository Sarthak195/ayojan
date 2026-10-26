import { describe, expect, it } from 'vitest';

import { interactionsClientFor } from '@/server/genai/client';

describe('interactionsClientFor', () => {
  it('builds one client per key and reuses it', () => {
    const first = interactionsClientFor('fake-key-one');
    expect(interactionsClientFor('fake-key-one')).toBe(first);
    expect(interactionsClientFor('fake-key-two')).not.toBe(first);
  });
});
