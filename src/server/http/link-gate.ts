import 'server-only';

import { isLang } from '@/i18n/lang';

import { loadSealKey } from '../state/seal-key';
import { decodeState } from '../state/token-codec';
import { problemResponse } from './problem-page';

// A page that calls notFound() outside a Suspense boundary goes down Next 16's error-recovery
// path, which sends an empty <html id="__next_error__"> shell and leaves the not-found UI to
// client-side JavaScript. With scripts off that is a blank page with no <html lang>, landmark
// or h1. The proxy runs before rendering, so it answers the two common cases itself with the
// script-free problem page: a first segment that is not a language, and a plan link that does
// not decode. The pages keep their notFound() for what only they can see (a link that decodes
// but no longer folds against the data).

const PLAN_PATH = /^\/(en|hi)\/p\/([^/]+)(?:\/(?:check|quotes|revision|messages))?\/?$/;

/** First segments that are not a language but still belong to the app or to Next itself. */
function isOwnedElsewhere(first: string): boolean {
  return first === '' || first === 'api' || first.startsWith('_');
}

/**
 * The problem page a GET would otherwise get as a script-only 404, or null to let the request
 * through. A seal key that cannot load is not the link's fault, so the page handles it (500).
 */
export function linkGateRefusal(
  method: string,
  pathname: string,
  sealKey: () => Uint8Array = loadSealKey,
): Response | null {
  if (method !== 'GET' && method !== 'HEAD') return null;
  const first = pathname.split('/')[1] ?? '';
  if (!isLang(first)) {
    return isOwnedElsewhere(first) ? null : problemResponse({ lang: 'en', problem: 'not-found' });
  }
  const match = PLAN_PATH.exec(pathname);
  const lang = match?.[1];
  const token = match?.[2];
  if (!isLang(lang) || token === undefined) return null;
  let key: Uint8Array;
  try {
    key = sealKey();
  } catch {
    return null;
  }
  if (decodeState(token, key).ok) return null;
  // 404, not the POST status: a GET of a damaged link is a missing page (D6).
  return problemResponse({ lang, problem: 'damaged-link', status: 404 });
}
