import type { ProblemsDictionary, ProblemText } from './areas/problems';
import { waitPhrase } from './wait';

/** Every problem a page or a route handler can answer with. */
export type ProblemKind =
  | 'not-found'
  | 'damaged-link'
  | 'link-full'
  | 'op-cap'
  | 'cross-site'
  | 'too-many-requests'
  | 'wrong-type'
  | 'too-large'
  | 'malformed'
  | 'text-too-long'
  | 'cannot-apply'
  | 'nothing-to-undo'
  | 'nothing-pending'
  | 'server-error';

/**
 * The status a route handler answers with (arch 6.3). A damaged link is 400 from a POST; a GET
 * page shows the same words through not-found.tsx, which Next answers with 404 (D6).
 */
export const PROBLEM_STATUS: Readonly<Record<ProblemKind, number>> = {
  'not-found': 404,
  'damaged-link': 400,
  'link-full': 422,
  'op-cap': 422,
  'cross-site': 403,
  'too-many-requests': 429,
  'wrong-type': 415,
  'too-large': 413,
  malformed: 400,
  'text-too-long': 422,
  'cannot-apply': 422,
  'nothing-to-undo': 422,
  'nothing-pending': 422,
  'server-error': 500,
};

/** Title and body for a problem; a 429 states the wait, rounded up to whole units. */
export function problemText(
  words: ProblemsDictionary,
  kind: ProblemKind,
  retryAfterSeconds = 60,
): ProblemText {
  switch (kind) {
    case 'not-found':
      return words.notFound;
    case 'damaged-link':
      return words.damagedLink;
    case 'link-full':
      return words.linkFull;
    case 'op-cap':
      return words.opCap;
    case 'cross-site':
      return words.crossSite;
    case 'too-many-requests':
      return {
        title: words.tooManyRequests.title,
        body: words.tooManyRequests.body(waitPhrase(retryAfterSeconds, words.wait)),
      };
    case 'wrong-type':
      return words.wrongType;
    case 'too-large':
      return words.tooLarge;
    case 'malformed':
      return words.malformed;
    case 'text-too-long':
      return words.textTooLong;
    case 'cannot-apply':
      return words.cannotApply;
    case 'nothing-to-undo':
      return words.nothingToUndo;
    case 'nothing-pending':
      return words.nothingPending;
    case 'server-error':
      return words.serverError;
  }
}
