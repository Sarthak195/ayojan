import { describe, expect, it } from 'vitest';

import { MAX_FORM_PAIRS, parseUrlencoded } from '@/server/http/urlencoded';

describe('parseUrlencoded', () => {
  it.each([
    { name: 'empty', body: '', fields: {} },
    { name: 'one field', body: 'a=1', fields: { a: '1' } },
    { name: 'plus is a space', body: 'text=8+lakh', fields: { text: '8 lakh' } },
    { name: 'a literal plus', body: 'text=1%2B1', fields: { text: '1+1' } },
    { name: 'percent-encoded Devanagari', body: 'text=%E0%A4%86', fields: { text: 'आ' } },
    { name: 'raw UTF-8 text', body: 'text=आयोजन', fields: { text: 'आयोजन' } },
    { name: 'a name without a value', body: 'a', fields: { a: '' } },
    { name: 'an empty value', body: 'a=', fields: { a: '' } },
    { name: 'an equals sign in the value', body: 'a=b=c', fields: { a: 'b=c' } },
    { name: 'empty pieces are skipped', body: '&a=1&&b=2&', fields: { a: '1', b: '2' } },
    { name: 'a repeated name is a list', body: 'lever=x&lever=y', fields: { lever: ['x', 'y'] } },
  ])('$name', ({ body, fields }) => {
    expect(parseUrlencoded(body)).toEqual(fields);
  });

  it.each([
    { name: 'a stray percent', body: 'a=100%' },
    { name: 'a bad escape', body: 'a=%zz' },
    { name: 'an escape that is not UTF-8', body: 'a=%FF' },
    { name: 'a truncated multi-byte escape', body: 'a=%E0%A4' },
    { name: 'an encoded lone surrogate', body: 'a=%ED%A0%80' },
    { name: 'a bad escape in the name', body: '%zz=1' },
    { name: 'an empty name', body: '=1' },
    {
      name: 'too many pairs',
      body: Array.from({ length: MAX_FORM_PAIRS + 1 }, (_, i) => `f${String(i)}=1`).join('&'),
    },
  ])('refuses $name', ({ body }) => {
    expect(parseUrlencoded(body)).toBeNull();
  });

  it('keeps "__proto__" as an ordinary key', () => {
    const fields = parseUrlencoded('__proto__=x&a=1');
    expect(Object.getPrototypeOf(fields)).toBe(Object.prototype);
    expect(Object.hasOwn(fields ?? {}, '__proto__')).toBe(true);
  });
});
