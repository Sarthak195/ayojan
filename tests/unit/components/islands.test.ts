import { readFileSync } from 'node:fs';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { CopyButton, CopyButtonView } from '@/components/islands/copy-button.client';
import {
  copyButtonName,
  copyFrom,
  runningTotalKey,
  tickedValues,
} from '@/components/islands/island-logic';

describe('copyFrom', () => {
  it('writes the text and reports success without selecting', async () => {
    const select = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(copyFrom({ value: 'hello', select }, { writeText })).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(select).not.toHaveBeenCalled();
  });

  it('selects the text for a manual copy when the write is refused', async () => {
    const select = vi.fn();
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    await expect(copyFrom({ value: 'hello', select }, { writeText })).resolves.toBe(false);
    expect(select).toHaveBeenCalledOnce();
  });
});

describe('copy button name and announcement', () => {
  it('starts with the visible label and adds the heading', () => {
    expect(copyButtonName('Copy', 'Message to the caterer')).toBe('Copy: Message to the caterer');
  });

  const view = (copied: boolean): string =>
    renderToStaticMarkup(
      createElement(CopyButtonView, {
        label: 'Copy',
        doneLabel: 'Copied',
        heading: 'Family update',
        copied,
        onCopy: () => undefined,
      }),
    );

  it('keeps an empty status region before a copy', () => {
    const html = view(false);
    expect(html).toContain('aria-label="Copy: Family update"');
    expect(html).toContain('>Copy</button>');
    expect(html).toContain('<span role="status" class="sr-only"></span>');
  });

  it('says the done label in the status region after a copy', () => {
    const html = view(true);
    expect(html).toContain('aria-label="Copied: Family update"');
    expect(html).toContain('<span role="status" class="sr-only">Copied: Family update</span>');
  });

  it('renders nothing on the server, where there is no clipboard', () => {
    const html = renderToStaticMarkup(
      createElement(CopyButton, {
        targetId: 'x',
        label: 'Copy',
        doneLabel: 'Copied',
        heading: 'H',
      }),
    );
    expect(html).toBe('');
  });
});

describe('running total key', () => {
  const order = ['a', 'b', 'c'];
  const refused = ['b'];

  it('lists ticked levers in data order, whatever order they were ticked in', () => {
    expect(runningTotalKey(order, refused, new Set(['c', 'a']), new Set())).toBe('a,c');
  });

  it('drops a refused lever until its Show anyway box is ticked too', () => {
    expect(runningTotalKey(order, refused, new Set(['a', 'b']), new Set())).toBe('a');
    expect(runningTotalKey(order, refused, new Set(['a', 'b']), new Set(['b']))).toBe('a,b');
  });

  it('ignores Show anyway on a lever that is not ticked, and is empty with nothing ticked', () => {
    expect(runningTotalKey(order, refused, new Set(), new Set(['b']))).toBe('');
  });

  it('keeps only string form values', () => {
    expect([...tickedValues(['a', new Blob([]), 'b', 3])]).toEqual(['a', 'b']);
  });
});

// WCAG 1.4.11: the border of a text input must be 3:1 against the page in both schemes.
describe('field border contrast', () => {
  const css = readFileSync('src/app/globals.css', 'utf8');
  const luminance = (hex: string): number => {
    const [r = 0, g = 0, b = 0] = [1, 3, 5].map((at) => {
      const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string): number => {
    const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const token = (block: string, name: string): string => {
    const found = new RegExp(`--${name}: (#[0-9a-f]{6});`).exec(block);
    if (found?.[1] === undefined) throw new Error(`no --${name}`);
    return found[1];
  };
  const [light = '', dark = ''] = css.split('@media (prefers-color-scheme: dark)');

  it.each([
    ['light', light],
    ['dark', dark],
  ])('is at least 3:1 on the page and the surface in %s', (_scheme, block) => {
    const line = token(block, 'field-line');
    expect(ratio(line, token(block, 'background'))).toBeGreaterThanOrEqual(3);
    expect(ratio(line, token(block, 'surface'))).toBeGreaterThanOrEqual(3);
  });
});
