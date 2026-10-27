import { describe, expect, it } from 'vitest';

import {
  callOutcome,
  classifyFailure,
  type CallOutcome,
  type FailureKind,
} from '@/server/genai/classify';

const withFields = (message: string, fields: object): Error =>
  Object.assign(new Error(message), fields);

describe('classifyFailure', () => {
  it.each<[string, unknown, FailureKind]>([
    ['429', withFields('x', { status: 429 }), 'rate-limit'],
    ['401', withFields('x', { status: 401 }), 'auth'],
    ['403 by statusCode', withFields('x', { statusCode: 403 }), 'auth'],
    ['404', withFields('x', { status: 404 }), 'retired'],
    ['408', withFields('x', { status: 408 }), 'overload'],
    ['500', withFields('x', { status: 500 }), 'overload'],
    ['503', withFields('x', { status: 503 }), 'overload'],
    ['400', withFields('x', { status: 400 }), 'our-bug'],
    ['422', withFields('x', { status: 422 }), 'our-bug'],
    ['409', withFields('x', { status: 409 }), 'transient'],
    [
      'a status that says abort is still classed by status',
      withFields('abort', { status: 429 }),
      'rate-limit',
    ],
    [
      'SDK timeout',
      withFields('Request timed out.', { name: 'APIConnectionTimeoutError' }),
      'overload',
    ],
    ['AbortSignal.timeout', withFields('signal', { name: 'TimeoutError' }), 'overload'],
    ['AbortController', withFields('signal', { name: 'AbortError' }), 'overload'],
    [
      'undici connect timeout code',
      withFields('x', { code: 'UND_ERR_CONNECT_TIMEOUT' }),
      'overload',
    ],
    ['undici body timeout name', withFields('x', { name: 'BodyTimeoutError' }), 'overload'],
    ['socket ETIMEDOUT', withFields('x', { code: 'ETIMEDOUT' }), 'overload'],
    ['a message saying timeout', new Error('Gateway timeout'), 'overload'],
    [
      'a timeout two causes deep',
      withFields('fetch failed', {
        cause: withFields('y', { cause: withFields('z', { code: 'UND_ERR_HEADERS_TIMEOUT' }) }),
      }),
      'overload',
    ],
    ['a connection error', new Error('Connection error.'), 'transient'],
    ['a thrown string', 'boom', 'transient'],
    ['undefined', undefined, 'transient'],
  ])('%s', (_name, error, kind) => {
    expect(classifyFailure(error)).toBe(kind);
  });

  it('stops on a cause that points back at itself', () => {
    const looped: Error & { cause?: unknown } = new Error('loop');
    looped.cause = looped;
    expect(classifyFailure(looped)).toBe('transient');
  });
});

describe('callOutcome', () => {
  it.each<[string, unknown, CallOutcome]>([
    [
      'SDK timeout',
      withFields('Request timed out.', { name: 'APIConnectionTimeoutError' }),
      'timeout',
    ],
    ['AbortSignal.timeout', withFields('signal', { name: 'TimeoutError' }), 'timeout'],
    [
      'undici timeout in the cause',
      withFields('fetch failed', { cause: withFields('y', { code: 'UND_ERR_BODY_TIMEOUT' }) }),
      'timeout',
    ],
    ['408', withFields('x', { status: 408 }), 'timeout'],
    ['503', withFields('x', { status: 503 }), 'overload'],
    [
      '500 saying timeout is still an overload',
      withFields('Gateway timeout', { status: 504 }),
      'overload',
    ],
    ['429', withFields('x', { status: 429 }), 'rate-limit'],
    ['401', withFields('x', { status: 401 }), 'auth'],
    ['404', withFields('x', { status: 404 }), 'retired'],
    ['400', withFields('x', { status: 400 }), 'error'],
    ['a connection error', new Error('Connection error.'), 'error'],
    ['a thrown string', 'boom', 'error'],
  ])('%s', (_name, error, outcome) => {
    expect(callOutcome(error)).toBe(outcome);
  });
});
