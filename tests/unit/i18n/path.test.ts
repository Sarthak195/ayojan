import { describe, expect, it } from 'vitest';

import { langOfHeader, langOfPath, switchedPath } from '@/i18n/path';

const TOKEN = 'AbC_d-9'.repeat(10);

describe('langOfPath', () => {
  it.each([
    ['/hi', 'hi'],
    ['/hi/p/abc/quotes', 'hi'],
    ['/en/form', 'en'],
    ['/', 'en'],
    ['/api/health', 'en'],
    ['/fr/form', 'en'],
    ['/HI', 'en'],
  ])('reads %s as %s', (path, lang) => {
    expect(langOfPath(path)).toBe(lang);
  });
});

describe('langOfHeader', () => {
  it('trusts only the two languages', () => {
    expect(langOfHeader('hi')).toBe('hi');
    expect(langOfHeader(null)).toBe('en');
    expect(langOfHeader('hi"><script>')).toBe('en');
  });
});

describe('switchedPath', () => {
  it.each([
    ['/en', '/hi'],
    ['/en/', '/hi'],
    ['/en/form', '/hi/form'],
    [`/en/p/${TOKEN}`, `/hi/p/${TOKEN}`],
    [`/en/p/${TOKEN}/quotes`, `/hi/p/${TOKEN}/quotes`],
    [`/en/p/${TOKEN}/revision`, `/hi/p/${TOKEN}/revision`],
  ])('keeps the page and token: %s', (from, to) => {
    expect(switchedPath(from, 'hi')).toBe(to);
  });

  it.each([
    '',
    '/',
    '/api/health',
    '//evil.example/en',
    '/en//evil.example',
    '/en/p/abc/unknown',
    '/en/p/a%2Fb',
    '/en/p/abc def',
    `/en/p/${'a'.repeat(4001)}`,
    '/en/form?x=<script>',
    '/en/p/abc\\evil',
  ])('falls back to the start page for %s', (path) => {
    expect(switchedPath(path, 'en')).toBe('/en');
  });
});
