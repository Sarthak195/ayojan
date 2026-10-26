import type { ReactElement } from 'react';

import type { Dictionary } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

import { LanguageSwitch } from './language-switch';

export interface SiteHeaderProps {
  readonly lang: Lang;
  readonly pathname: string;
  readonly common: Dictionary['common'];
}

// The product name is a link, never a heading: each page owns its one h1.
export function SiteHeader({ lang, pathname, common }: SiteHeaderProps): ReactElement {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4">
        <a
          href={`/${lang}`}
          aria-label={common.homeLink}
          className="inline-flex min-h-11 items-center text-lg font-bold no-underline"
        >
          {common.productName}
        </a>
        <LanguageSwitch
          lang={lang}
          pathname={pathname}
          navLabel={common.languageNav}
          currentLabel={common.currentLanguage}
        />
      </div>
    </header>
  );
}
