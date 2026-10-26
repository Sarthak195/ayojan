import 'server-only';

import { LeverId } from '@/schemas/generated/ids';

// Every POST answers 303 so reload and back are safe (arch 6.1). The Location is RELATIVE:
// an absolute URL built from request.url came out as http://0.0.0.0:8080 behind Cloud Run,
// because the container sees its own bind address, not the public host. It is assembled
// only from fixed route words, a sealed token re-checked against its charset, and closed
// enums, so no user text can enter a URL and no input can make it point off-site (no open
// redirect, NFR-SEC-10).

export type Lang = 'en' | 'hi';
export type PlanPage = 'plan' | 'check' | 'quotes' | 'revision' | 'messages';
/** Sections a 303 lands on, so focus context survives the round trip (arch 8). */
export type Anchor = 'tasks' | 'change-form' | 'quote-form';
/** Why the AI reader was unavailable; the banner on the form names it (D18). */
export type UnavailableReason = 'quota' | 'timeout' | 'nokey';

export type Destination =
  | { readonly to: 'start'; readonly lang: Lang }
  | { readonly to: 'form'; readonly lang: Lang; readonly unavailable?: UnavailableReason }
  | {
      readonly to: PlanPage;
      readonly lang: Lang;
      readonly token: string;
      readonly anchor?: Anchor;
      readonly unavailable?: UnavailableReason;
      /** Lever ids for the revision preview (`?sel=`). */
      readonly selection?: readonly string[];
    };

/** Thrown when a caller passes a value that must never reach a URL: a bug, so a 500. */
export class UnsafeLocationError extends Error {
  override readonly name = 'UnsafeLocationError';
}

const LANGS: readonly Lang[] = ['en', 'hi'];
const PLAN_SUFFIX: Readonly<Record<PlanPage, string>> = {
  plan: '',
  check: '/check',
  quotes: '/quotes',
  revision: '/revision',
  messages: '/messages',
};
const ANCHORS: readonly Anchor[] = ['tasks', 'change-form', 'quote-form'];
const REASONS: readonly UnavailableReason[] = ['quota', 'timeout', 'nokey'];
const PAGES: readonly PlanPage[] = ['plan', 'check', 'quotes', 'revision', 'messages'];
// Matches the token codec's own refusal, so only something it could decode is ever echoed.
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{1,4000}$/;
// The whole result, as a last check that no branch above let anything else through.
const LOCATION_SHAPE =
  /^\/(?:en|hi)(?:\/(?:form|p\/[A-Za-z0-9_-]+(?:\/[a-z]+)?))?(?:\?[a-z]+=[a-z0-9,-]+(?:&[a-z]+=[a-z0-9,-]+)*)?(?:#[a-z-]+)?$/;

// Re-checked at runtime because the values come from route params and form fields, where the
// static types are only as good as the caller's parsing.
function oneOf<T extends string>(value: string, allowed: readonly T[], what: string): T {
  const known = allowed.find((item) => item === value);
  if (known === undefined) throw new UnsafeLocationError(`Not a known ${what}.`);
  return known;
}

function query(destination: Destination): string {
  const pairs: string[] = [];
  if (destination.to !== 'start' && destination.unavailable !== undefined) {
    const why = oneOf(destination.unavailable, REASONS, 'reason');
    pairs.push('ai=unavailable', `why=${why}`);
  }
  if (destination.to === 'revision' && destination.selection !== undefined) {
    const ids = destination.selection.map((id) => {
      if (!LeverId.safeParse(id).success) throw new UnsafeLocationError('Not a known lever.');
      return id;
    });
    if (ids.length > 0) pairs.push(`sel=${[...new Set(ids)].join(',')}`);
  }
  return pairs.length === 0 ? '' : `?${pairs.join('&')}`;
}

/** The relative Location for a destination, or a throw if any part is not a known value. */
export function locationOf(destination: Destination): string {
  const lang = oneOf(destination.lang, LANGS, 'language');
  let path = `/${lang}`;
  let anchor = '';
  if (destination.to === 'form') {
    path += '/form';
  } else if (destination.to !== 'start') {
    if (!TOKEN_SHAPE.test(destination.token)) throw new UnsafeLocationError('Not a token.');
    const suffix = PLAN_SUFFIX[oneOf(destination.to, PAGES, 'page')];
    path += `/p/${destination.token}${suffix}`;
    if (destination.anchor !== undefined) {
      anchor = `#${oneOf(destination.anchor, ANCHORS, 'section')}`;
    }
  }
  const location = `${path}${query(destination)}${anchor}`;
  if (!LOCATION_SHAPE.test(location)) throw new UnsafeLocationError('Unexpected location shape.');
  return location;
}

/**
 * A 303 See Other to a relative Location. Built by hand because Response.redirect insists on
 * an absolute URL. `no-store` keeps a proxy from caching a step's answer.
 */
export function seeOther(destination: Destination): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: locationOf(destination), 'Cache-Control': 'no-store' },
  });
}
