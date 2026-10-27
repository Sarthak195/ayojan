import { describe, expect, it } from 'vitest';

import { boxRows } from '@/app/[lang]/p/[token]/messages/_messages/box-rows';

describe('boxRows', () => {
  it('has a floor so a one-line message is not a sliver', () => {
    expect(boxRows('Hello')).toBe(3);
  });

  it('counts one row per short line plus one spare', () => {
    expect(boxRows('a\nb\nc\nd')).toBe(5);
  });

  it('counts the rows a long line wraps onto, by characters not bytes', () => {
    const hindi = 'हमारी शादी की ताज़ा जानकारी आपके लिए है। '.repeat(3).trim();
    const chars = Array.from(hindi).length;
    expect(boxRows(hindi)).toBe(Math.ceil(chars / 32) + 1);
    expect(boxRows(hindi)).toBeGreaterThan(boxRows('a\nb\nc'));
  });

  it('is capped so a huge message scrolls instead of filling the page', () => {
    expect(boxRows('x\n'.repeat(500))).toBe(40);
  });
});
