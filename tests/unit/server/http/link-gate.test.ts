import { describe, expect, it } from 'vitest';

import { linkGateRefusal } from '@/server/http/link-gate';

import { BRIEF_STATE, OTHER_KEY, SEAL_KEY, seal } from './step-support';

const key = (): Uint8Array => SEAL_KEY;
const GOOD = seal(BRIEF_STATE);

async function bodyOf(response: Response | null): Promise<string> {
  expect(response).not.toBeNull();
  return response === null ? '' : response.text();
}

describe('linkGateRefusal', () => {
  it.each(['/', '/en', '/hi/form', '/api/health', '/_next/data/x', '/en/nothing/here'])(
    'lets %s through',
    (path) => {
      expect(linkGateRefusal('GET', path, key)).toBeNull();
    },
  );

  it.each(['', '/check', '/quotes', '/revision', '/messages'])(
    'lets a good plan link through (page suffix "%s")',
    (suffix) => {
      expect(linkGateRefusal('GET', `/hi/p/${GOOD}${suffix}`, key)).toBeNull();
    },
  );

  it('answers an unknown language with a full English 404 page', async () => {
    const response = linkGateRefusal('GET', '/xx', key);
    expect(response?.status).toBe(404);
    const html = await bodyOf(response);
    expect(html).toContain('<html lang="en">');
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toContain('<main id="main">');
    expect(html).not.toContain('<script');
  });

  it.each([
    ['a tampered token', `${GOOD.slice(0, -4)}AAAA`],
    ['a cut token', GOOD.slice(0, 40)],
    ['a token sealed with another key', seal(BRIEF_STATE, OTHER_KEY)],
  ])('answers %s with the damaged-link page in the path language', async (_name, token) => {
    const response = linkGateRefusal('GET', `/hi/p/${token}/quotes`, key);
    expect(response?.status).toBe(404);
    const html = await bodyOf(response);
    expect(html).toContain('<html lang="hi">');
    expect(html).not.toContain(token);
  });

  it('leaves POSTs to the route handlers, which answer 400 with a back link', () => {
    expect(linkGateRefusal('POST', '/en/p/AAAA', key)).toBeNull();
    expect(linkGateRefusal('POST', '/xx/confirm', key)).toBeNull();
  });

  it('lets the page report a seal key that will not load, rather than blaming the link', () => {
    const broken = (): Uint8Array => {
      throw new Error('no key');
    };
    expect(linkGateRefusal('GET', '/en/p/AAAA', broken)).toBeNull();
  });
});
