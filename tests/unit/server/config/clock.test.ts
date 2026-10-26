import { describe, expect, it } from 'vitest';

import { quotaDayKey, secondsUntilNextQuotaDay, todayInIndia } from '@/server/config/clock';

const at = (iso: string) => () => Date.parse(iso);

describe('todayInIndia', () => {
  it.each([
    { instant: '2026-10-26T18:29:59.999Z', today: '2026-10-26' },
    { instant: '2026-10-26T18:30:00.000Z', today: '2026-10-27' },
    { instant: '2026-10-26T00:00:00.000Z', today: '2026-10-26' },
    { instant: '2026-12-31T18:29:59.999Z', today: '2026-12-31' },
    { instant: '2026-12-31T18:30:00.000Z', today: '2027-01-01' },
    { instant: '2028-02-28T18:30:00.000Z', today: '2028-02-29' },
  ])('$instant is $today in Asia/Kolkata', ({ instant, today }) => {
    expect(todayInIndia(at(instant))).toBe(today);
  });

  it('reads the real clock when no instant is injected', () => {
    expect(todayInIndia()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('quotaDayKey', () => {
  it.each([
    // Daylight time: the quota day turns at 07:00 UTC (12:30 IST).
    { instant: '2026-10-27T06:59:59Z', key: '2026-10-26' },
    { instant: '2026-10-27T07:00:00Z', key: '2026-10-27' },
    // Standard time from Sunday 1 November: it turns at 08:00 UTC (13:30 IST).
    { instant: '2026-11-02T07:59:59Z', key: '2026-11-01' },
    { instant: '2026-11-02T08:00:00Z', key: '2026-11-02' },
    { instant: '2027-01-01T07:59:59Z', key: '2026-12-31' },
  ])('$instant falls on quota day $key', ({ instant, key }) => {
    expect(quotaDayKey(at(instant))).toBe(key);
  });
});

describe('secondsUntilNextQuotaDay', () => {
  it.each([
    { name: 'a whole daylight-time day', instant: '2026-10-26T07:00:00Z', seconds: 86_400 },
    { name: 'one second before the turn', instant: '2026-10-27T06:59:59Z', seconds: 1 },
    { name: 'part of a second is rounded up', instant: '2026-10-27T06:59:59.500Z', seconds: 1 },
    {
      name: 'the 25-hour day daylight time ends on',
      instant: '2026-11-01T07:00:00Z',
      seconds: 90_000,
    },
    { name: 'after the clocks went back', instant: '2026-11-01T12:00:00Z', seconds: 72_000 },
    {
      name: 'the 23-hour day daylight time starts on',
      instant: '2027-03-14T08:00:00Z',
      seconds: 82_800,
    },
  ])('$name', ({ instant, seconds }) => {
    expect(secondsUntilNextQuotaDay(at(instant))).toBe(seconds);
  });
});
