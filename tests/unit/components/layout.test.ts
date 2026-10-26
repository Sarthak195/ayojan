import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LanguageSwitch } from '@/components/layout/language-switch';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { SkipLink } from '@/components/layout/skip-link';
import { dictionaryFor } from '@/i18n/dictionary';

describe('layout components', () => {
  it('skip link targets the main landmark', () => {
    const html = renderToStaticMarkup(createElement(SkipLink, { label: 'Skip to main content' }));
    expect(html).toContain('href="#main"');
    expect(html).toContain('Skip to main content');
  });

  it('header names the product without a heading and links home in its language', () => {
    const html = renderToStaticMarkup(
      createElement(SiteHeader, {
        lang: 'hi',
        pathname: '/hi/form',
        common: dictionaryFor('hi').common,
      }),
    );
    expect(html).toContain('<header');
    expect(html).not.toMatch(/<h[1-6]/);
    expect(html).toContain('href="/hi"');
    expect(html).toContain('आयोजन');
  });

  it('language switch links the other language to the same page and marks the current one', () => {
    const html = renderToStaticMarkup(
      createElement(LanguageSwitch, {
        lang: 'en',
        pathname: '/en/p/tok_en-1/revision',
        navLabel: 'Language',
        currentLabel: 'current language',
      }),
    );
    expect(html).toContain('<nav aria-label="Language">');
    expect(html).toContain('href="/hi/p/tok_en-1/revision"');
    expect(html).toContain('hrefLang="hi"');
    expect(html).toMatch(/<span lang="en" aria-current="true"/);
    expect(html).not.toContain('href="/en');
  });

  it('footer carries the D27 sentence in each language', () => {
    for (const lang of ['en', 'hi'] as const) {
      const privacy = dictionaryFor(lang).common.privacyFooter;
      const html = renderToStaticMarkup(createElement(SiteFooter, { privacy }));
      expect(html).toContain('<footer');
      expect(html).toContain(privacy);
    }
  });
});
