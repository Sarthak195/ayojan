// The language lives in the URL path (/en/..., /hi/...), so a shared link opens in the
// sender's language and the server never guesses from Accept-Language.

export const LANGS = ['en', 'hi'] as const;
export type Lang = (typeof LANGS)[number];

/** The fallback for paths with no language segment, such as `/` and `/api/health`. */
export const DEFAULT_LANG: Lang = 'en';

export function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'hi';
}

export function otherLang(lang: Lang): Lang {
  return lang === 'en' ? 'hi' : 'en';
}

/** Each language named in itself, so a reader who cannot read the page can still find theirs. */
export const LANGUAGE_NAMES: Readonly<Record<Lang, string>> = {
  en: 'English',
  hi: 'हिन्दी',
};
