import type { ReactElement } from 'react';

import { LANGS, LANGUAGE_NAMES, type Lang } from '@/i18n/lang';
import { switchedPath } from '@/i18n/path';

export interface LanguageSwitchProps {
  readonly lang: Lang;
  /** The current path from the proxy; only known page shapes are kept (see switchedPath). */
  readonly pathname: string;
  readonly navLabel: string;
  readonly currentLabel: string;
}

/**
 * "English | हिन्दी": the other language is a plain link to the same page with the same token,
 * so a shared link can be switched without JavaScript. Each name carries its own lang.
 */
export function LanguageSwitch({
  lang,
  pathname,
  navLabel,
  currentLabel,
}: LanguageSwitchProps): ReactElement {
  return (
    <nav aria-label={navLabel}>
      <ul className="flex items-center gap-1">
        {LANGS.map((each) => (
          <li key={each}>
            {each === lang ? (
              <span
                lang={each}
                aria-current="true"
                className="inline-flex min-h-11 items-center px-2 font-semibold"
              >
                {LANGUAGE_NAMES[each]}
                <span className="sr-only"> ({currentLabel})</span>
              </span>
            ) : (
              <a
                href={switchedPath(pathname, each)}
                lang={each}
                hrefLang={each}
                className="inline-flex min-h-11 min-w-11 items-center px-2"
              >
                {LANGUAGE_NAMES[each]}
              </a>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
