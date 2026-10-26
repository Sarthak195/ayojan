import { DEFAULT_LANG, isLang, type Lang } from './lang';

// The proxy reads the language off the path and hands it to the root layout on request
// headers, because the layout sits above the [lang] segment and cannot see its params.
// The proxy always overwrites both headers, so a value a client sends is never trusted.
export const LANG_HEADER = 'x-lang';
export const PATH_HEADER = 'x-pathname';

/** The language named by the first path segment, or the default for any other path. */
export function langOfPath(pathname: string): Lang {
  const first = pathname.split('/')[1];
  return isLang(first) ? first : DEFAULT_LANG;
}

/** A header value as a language; anything unexpected falls back rather than reaching <html lang>. */
export function langOfHeader(value: string | null): Lang {
  return isLang(value) ? value : DEFAULT_LANG;
}

// Only the app's own page shapes survive a language switch: the start page, the form and the
// plan pages with their sealed token (the codec's charset and cap). Anything else, including
// the query string, is dropped, so a crafted address can never be echoed into a link.
const SWITCHABLE =
  /^\/(?:en|hi)((?:\/form)|(?:\/p\/[A-Za-z0-9_-]{1,4000}(?:\/(?:check|quotes|revision|messages))?))?\/?$/;

/** The same page in another language, keeping the token; the start page when the path is unknown. */
export function switchedPath(pathname: string, to: Lang): string {
  const match = SWITCHABLE.exec(pathname);
  return `/${to}${match?.[1] ?? ''}`;
}
