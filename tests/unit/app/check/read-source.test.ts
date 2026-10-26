import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ReadSource } from '@/app/[lang]/p/[token]/check/read-source';
import type { ReadBy } from '@/schemas/plan/brief';

function html(readBy: ReadBy, lang: 'en' | 'hi' = 'en'): string {
  return renderToStaticMarkup(createElement(ReadSource, { readBy, label: 'Read by AI', lang }));
}

// AGENTS.md item 1: the page names the model that answered, as the server reported it.
describe('the reading source line', () => {
  it('names the answering model under an AI reading, in both languages', () => {
    const readBy: ReadBy = { source: 'ai', model: 'gemini-3.5-flash-lite', matched: 5, total: 5 };
    expect(html(readBy)).toContain('Answered by the model gemini-3.5-flash-lite.');
    expect(html(readBy, 'hi')).toContain('जवाब देने वाला मॉडल: gemini-3.5-flash-lite।');
  });

  it('names no model for the form, or when none was recorded', () => {
    expect(html({ source: 'form', model: null, matched: 0, total: 0 })).not.toContain('model');
    expect(html({ source: 'ai-cached', model: null, matched: 1, total: 1 })).not.toContain('model');
  });
});
