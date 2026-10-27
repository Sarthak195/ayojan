import { describe, expect, it } from 'vitest';

import { createLogger, formatLogLine, type LogFields } from '@/server/observability/logger';

// Distinctive phrases from the fixtures (arch 7): if either reaches a log line, user text is
// leaking, whatever path it took.
const PHRASES = ['Nani wheelchair', '1300/plate'];
const BRIEF =
  'Shaadi in Feb, 8 lakh budget, Nani wheelchair so ground floor, caterer said 1300/plate';

function capture() {
  const lines: string[] = [];
  return { lines, logger: createLogger((line) => lines.push(line)) };
}

// Every way a careless or hostile caller could try to smuggle the brief through.
const ATTEMPTS: { name: string; event: string; fields: Record<string, unknown> }[] = [
  { name: 'as the event name', event: BRIEF, fields: {} },
  { name: 'as an unlisted field', event: 'read', fields: { brief: BRIEF, text: BRIEF } },
  ...[
    'route',
    'opKind',
    'readingSource',
    'promptId',
    'reason',
    'answeredBy',
    'model',
    'outcome',
    'client',
    'errorName',
  ].flatMap((field) =>
    PHRASES.concat(BRIEF).map((value) => ({
      name: `in ${field} as "${value.slice(0, 16)}"`,
      event: 'read',
      fields: { [field]: value },
    })),
  ),
  { name: 'as a string count', event: 'read', fields: { count: '1300/plate', status: BRIEF } },
  { name: 'as a nested object', event: 'read', fields: { durationMs: { note: BRIEF } } },
  { name: 'as an array', event: 'read', fields: { verified: [BRIEF] } },
  { name: 'as a model id suffix', event: 'read', fields: { answeredBy: `gemini-x ${BRIEF}` } },
  { name: 'as an error message', event: 'failed', fields: { errorName: new Error(BRIEF).message } },
];

describe('logger privacy', () => {
  it.each(ATTEMPTS)('never writes the brief $name', ({ event, fields }) => {
    const { lines, logger } = capture();
    // No cast needed: a loose record type-checks as LogFields, which is why the runtime check exists.
    logger.info(event, fields);
    logger.warn(event, fields);
    logger.error(event, fields);
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      for (const phrase of PHRASES) expect(line).not.toContain(phrase);
      expect(line.toLowerCase()).not.toContain('nani');
      expect(line).not.toContain('1300');
    }
  });

  it('counts what it dropped without repeating it', () => {
    const line = formatLogLine('INFO', 'read', { brief: BRIEF, status: 200 } as LogFields);
    expect(JSON.parse(line)).toEqual({
      severity: 'INFO',
      message: 'read',
      event: 'read',
      status: 200,
      dropped: 1,
    });
  });
});

describe('logger format', () => {
  it('writes one JSON line per event with every allowlisted field', () => {
    const { lines, logger } = capture();
    logger.info('read', {
      route: '/[lang]/read/[kind]',
      status: 303,
      durationMs: 5123.6,
      opKind: 'changeConfirmed',
      readingSource: 'cache',
      promptId: 'brief',
      reason: 'quota',
      answeredBy: 'gemini-3.5-flash-lite',
      model: 'gemini-3.1-flash-lite',
      outcome: 'rate-limit',
      keyIndex: 2,
      attempt: 1,
      cacheHit: true,
      verified: 11,
      claimed: 12,
      tokenLength: 2760,
      bytes: 1024,
      count: 3,
      retryAfterSeconds: 10,
      client: 'ab'.repeat(32),
      errorName: 'TimeoutError',
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.endsWith('\n')).toBe(true);
    expect(JSON.parse(lines[0] ?? '')).toMatchObject({
      severity: 'INFO',
      event: 'read',
      durationMs: 5124,
      answeredBy: 'gemini-3.5-flash-lite',
      model: 'gemini-3.1-flash-lite',
      outcome: 'rate-limit',
      cacheHit: true,
    });
    expect(lines[0]).not.toContain('dropped');
  });

  it.each([
    { name: 'a status outside HTTP', fields: { status: 9999 } },
    { name: 'a fractional count', fields: { count: 1.5 } },
    { name: 'a negative duration', fields: { durationMs: -1 } },
    { name: 'an infinite duration', fields: { durationMs: Number.POSITIVE_INFINITY } },
    { name: 'a concrete path holding a token', fields: { route: '/en/p/AbC_dEf-123' } },
    { name: 'a raw address as the client', fields: { client: '203.0.113.9' } },
  ])('drops $name', ({ fields }) => {
    expect(JSON.parse(formatLogLine('INFO', 'read', fields))).toMatchObject({ dropped: 1 });
  });

  it.each([
    { severity: 'warn', expected: 'WARNING' },
    { severity: 'error', expected: 'ERROR' },
  ] as const)('maps $severity to the Cloud Logging severity', ({ severity, expected }) => {
    const { lines, logger } = capture();
    logger[severity]('model-failure', { status: 429 });
    expect(JSON.parse(lines[0] ?? '')).toMatchObject({ severity: expected });
  });

  it('keeps going when the sink throws', () => {
    const logger = createLogger(() => {
      throw new Error('EPIPE');
    });
    expect(() => {
      logger.error('unexpected-error');
    }).not.toThrow();
  });
});
