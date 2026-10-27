import { describe, expect, it } from 'vitest';

import {
  UnsafeLocationError,
  locationOf,
  seeOther,
  type Destination,
} from '@/server/http/see-other';

const TOKEN = 'AbC_dEf-0123456789';

describe('locationOf', () => {
  it.each<{ destination: Destination; location: string }>([
    { destination: { to: 'start', lang: 'en' }, location: '/en' },
    { destination: { to: 'form', lang: 'hi' }, location: '/hi/form' },
    {
      destination: { to: 'form', lang: 'en', unavailable: 'quota' },
      location: '/en/form?ai=unavailable&why=quota',
    },
    { destination: { to: 'plan', lang: 'en', token: TOKEN }, location: `/en/p/${TOKEN}` },
    {
      destination: { to: 'plan', lang: 'hi', token: TOKEN, anchor: 'tasks' },
      location: `/hi/p/${TOKEN}#tasks`,
    },
    {
      destination: { to: 'check', lang: 'en', token: TOKEN },
      location: `/en/p/${TOKEN}/check#check-summary`,
    },
    {
      destination: {
        to: 'quotes',
        lang: 'en',
        token: TOKEN,
        unavailable: 'timeout',
        anchor: 'quote-form',
      },
      location: `/en/p/${TOKEN}/quotes?ai=unavailable&why=timeout#quote-form`,
    },
    {
      destination: {
        to: 'plan',
        lang: 'en',
        token: TOKEN,
        unavailable: 'nokey',
        anchor: 'change-form',
      },
      location: `/en/p/${TOKEN}?ai=unavailable&why=nokey#change-form`,
    },
    {
      destination: {
        to: 'revision',
        lang: 'en',
        token: TOKEN,
        selection: ['e-invites', 'simpler-decor', 'e-invites'],
      },
      location: `/en/p/${TOKEN}/revision?sel=e-invites,simpler-decor`,
    },
    {
      destination: { to: 'revision', lang: 'en', token: TOKEN, selection: [] },
      location: `/en/p/${TOKEN}/revision`,
    },
    {
      destination: { to: 'messages', lang: 'hi', token: TOKEN },
      location: `/hi/p/${TOKEN}/messages`,
    },
  ])('$location', ({ destination, location }) => {
    expect(locationOf(destination)).toBe(location);
  });

  const hostile: { name: string; destination: Destination }[] = [
    {
      name: 'a protocol-relative token',
      destination: { to: 'plan', lang: 'en', token: '/evil.example' },
    },
    {
      name: 'a scheme in the token',
      destination: { to: 'plan', lang: 'en', token: 'https://evil' },
    },
    { name: 'a backslash in the token', destination: { to: 'plan', lang: 'en', token: '\\evil' } },
    {
      name: 'a control character',
      destination: { to: 'plan', lang: 'en', token: 'abc\r\nSet-Cookie' },
    },
    { name: 'a space', destination: { to: 'plan', lang: 'en', token: 'Nani wheelchair' } },
    { name: 'an empty token', destination: { to: 'plan', lang: 'en', token: '' } },
    { name: 'an overlong token', destination: { to: 'plan', lang: 'en', token: 'a'.repeat(4001) } },
    { name: 'an unknown language', destination: { to: 'start', lang: '//evil' as 'en' } },
    { name: 'an unknown page', destination: { to: '../x' as 'plan', lang: 'en', token: TOKEN } },
    {
      name: 'an unknown section',
      destination: { to: 'plan', lang: 'en', token: TOKEN, anchor: 'x"y' as 'tasks' },
    },
    {
      name: 'an unknown reason',
      destination: { to: 'form', lang: 'en', unavailable: 'quota&next=//evil' as 'quota' },
    },
    {
      name: 'an unknown lever',
      destination: {
        to: 'revision',
        lang: 'en',
        token: TOKEN,
        selection: ['e-invites', '1300/plate'],
      },
    },
  ];

  it.each(hostile)('refuses $name', ({ destination }) => {
    expect(() => locationOf(destination)).toThrow(UnsafeLocationError);
  });
});

describe('seeOther', () => {
  it('answers 303 with a relative Location and no body', async () => {
    const response = seeOther({ to: 'check', lang: 'en', token: TOKEN });
    expect(response.status).toBe(303);
    const location = response.headers.get('location') ?? '';
    expect(location).toBe(`/en/p/${TOKEN}/check#check-summary`);
    expect(location.startsWith('/')).toBe(true);
    expect(location).not.toContain('//');
    expect(location).not.toMatch(/^[a-z]+:/i);
    expect(location).not.toContain('0.0.0.0');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.text()).toBe('');
  });
});
