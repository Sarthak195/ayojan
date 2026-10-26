import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { TextField, TokenField } from '@/schemas/forms/form-field';
import { LeverChoice } from '@/schemas/forms/lever-choice';
import { TaskEvent } from '@/schemas/forms/task-event';
import {
  MAX_BODY_BYTES,
  MAX_TEXT_CODE_POINTS,
  readForm,
  type FormRequest,
} from '@/server/http/form-body';

const FORM = 'application/x-www-form-urlencoded';
const ReadForm = z.strictObject({ token: TokenField.optional(), text: TextField });

function post(body: string, headers: Record<string, string> = { 'content-type': FORM }) {
  return new Request('http://localhost/en/read/brief', { method: 'POST', headers, body });
}

describe('readForm statuses', () => {
  const TOKEN = 'A'.repeat(3_000);
  it.each([
    {
      name: 'a valid task event',
      body: 'token=abc&taskId=venue&event=delayed&days=10',
      status: 200,
    },
    {
      name: 'charset utf-8 is accepted',
      body: 'text=hi',
      type: `${FORM}; charset=UTF-8`,
      schema: ReadForm,
      status: 200,
    },
    {
      name: 'upper-case media type',
      body: 'text=hi',
      type: FORM.toUpperCase(),
      schema: ReadForm,
      status: 200,
    },
    { name: 'JSON', body: '{"text":"hi"}', type: 'application/json', status: 415 },
    { name: 'multipart', body: '--x\r\n', type: 'multipart/form-data; boundary=x', status: 415 },
    { name: 'no content type', body: 'text=hi', type: null, status: 415 },
    { name: 'plain text', body: 'text=hi', type: 'text/plain', status: 415 },
    { name: 'another charset', body: 'text=hi', type: `${FORM}; charset=iso-8859-1`, status: 415 },
    {
      name: 'a body one byte over the cap',
      body: `text=${'a'.repeat(MAX_BODY_BYTES - 4)}`,
      schema: ReadForm,
      status: 413,
    },
    { name: 'a bad escape', body: 'text=%E0%A4', schema: ReadForm, status: 400 },
    { name: 'an empty body', body: '', status: 400 },
    {
      name: 'an unknown field',
      body: 'token=abc&taskId=venue&event=delayed&days=10&admin=1',
      status: 400,
    },
    {
      name: 'a repeated scalar field',
      body: 'token=abc&token=def&taskId=venue&event=delayed&days=10',
      status: 400,
    },
    {
      name: 'a delay outside 1 to 60 days',
      body: 'token=abc&taskId=venue&event=delayed&days=61',
      status: 400,
    },
    {
      name: 'a non-integer amount',
      body: 'token=abc&taskId=venue&event=done&amountInr=1.5',
      status: 400,
    },
    { name: 'a "__proto__" field', body: '__proto__=x&text=hi', schema: ReadForm, status: 400 },
    {
      name: 'text at the cap',
      body: `text=${'a'.repeat(MAX_TEXT_CODE_POINTS)}`,
      schema: ReadForm,
      status: 200,
    },
    {
      name: 'text one code point over',
      body: `text=${'a'.repeat(MAX_TEXT_CODE_POINTS + 1)}`,
      schema: ReadForm,
      status: 422,
    },
    {
      name: 'Devanagari at the cap',
      body: `text=${'आ'.repeat(MAX_TEXT_CODE_POINTS)}`,
      schema: ReadForm,
      status: 200,
    },
    {
      name: 'emoji at the cap',
      body: `text=${'\u{1F389}'.repeat(MAX_TEXT_CODE_POINTS)}`,
      schema: ReadForm,
      status: 200,
    },
    {
      name: 'emoji over the cap',
      body: `text=${'\u{1F389}'.repeat(MAX_TEXT_CODE_POINTS + 1)}`,
      schema: ReadForm,
      status: 422,
    },
    {
      name: 'a long token is not free text',
      body: `token=${TOKEN}&text=hi`,
      schema: ReadForm,
      status: 200,
    },
  ])('$name: $status', async ({ body, type = FORM, schema = TaskEvent, status }) => {
    const headers: Record<string, string> = type === null ? {} : { 'content-type': type };
    const result = await readForm(post(body, headers), schema);
    expect(result.ok ? 200 : result.status).toBe(status);
  });

  it('returns the parsed fields, with repeated names as lists', async () => {
    const result = await readForm(
      post('token=abc&intent=preview&lever=e-invites&lever=simpler-decor'),
      LeverChoice,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        token: 'abc',
        intent: 'preview',
        lever: ['e-invites', 'simpler-decor'],
        showAnyway: [],
      },
    });
  });

  it.each([
    { reason: 'wrong-type', status: 415, type: 'application/json', body: '{}' },
    { reason: 'too-large', status: 413, type: FORM, body: 'x'.repeat(MAX_BODY_BYTES + 1) },
    { reason: 'malformed', status: 400, type: FORM, body: 'text=%' },
    {
      reason: 'invalid',
      status: 422,
      type: FORM,
      body: `text=${'a'.repeat(MAX_TEXT_CODE_POINTS + 1)}`,
    },
  ])('names the reason $reason with status $status', async ({ reason, status, type, body }) => {
    expect(await readForm(post(body, { 'content-type': type }), ReadForm)).toEqual({
      ok: false,
      reason,
      status,
    });
  });
});

/** An endless body that records how much of it was ever pulled. */
function endlessBody(chunkBytes: number) {
  const seen = { pulls: 0, cancelled: false };
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      seen.pulls += 1;
      controller.enqueue(new Uint8Array(chunkBytes).fill(0x61));
    },
    cancel() {
      seen.cancelled = true;
    },
  });
  return { body, seen };
}

describe('readForm byte cap', () => {
  it('refuses a declared Content-Length over the cap without reading a byte', async () => {
    const { body, seen } = endlessBody(4096);
    const request: FormRequest = {
      headers: new Headers({ 'content-type': FORM, 'content-length': '1000000000' }),
      body,
    };
    expect(await readForm(request, ReadForm)).toMatchObject({ status: 413 });
    expect(seen.pulls).toBeLessThanOrEqual(1);
  });

  it('stops an endless chunked body at the cap and cancels it', async () => {
    const { body, seen } = endlessBody(4096);
    const request: FormRequest = { headers: new Headers({ 'content-type': FORM }), body };
    expect(await readForm(request, ReadForm)).toMatchObject({ status: 413 });
    expect(seen.pulls).toBeLessThanOrEqual(MAX_BODY_BYTES / 4096 + 2);
    expect(seen.cancelled).toBe(true);
  });

  it('still stops at the cap when Content-Length understates the body', async () => {
    const { body, seen } = endlessBody(4096);
    const request: FormRequest = {
      headers: new Headers({ 'content-type': FORM, 'content-length': '10' }),
      body,
    };
    expect(await readForm(request, ReadForm)).toMatchObject({ status: 413 });
    expect(seen.cancelled).toBe(true);
  });

  it.each(['abc', '-1', '1e9', ''])('treats Content-Length "%s" as malformed', async (length) => {
    const request: FormRequest = {
      headers: new Headers({ 'content-type': FORM, 'content-length': length }),
      body: null,
    };
    expect(await readForm(request, ReadForm)).toMatchObject({ status: 400 });
  });

  it('answers 400 when the stream breaks mid-body', async () => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error('connection reset'));
      },
    });
    const request: FormRequest = { headers: new Headers({ 'content-type': FORM }), body };
    expect(await readForm(request, ReadForm)).toMatchObject({ status: 400 });
  });

  it('answers 400 for bytes that are not UTF-8', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([0x74, 0x65, 0x78, 0x74, 0x3d, 0xff]));
        controller.close();
      },
    });
    const request: FormRequest = { headers: new Headers({ 'content-type': FORM }), body };
    expect(await readForm(request, ReadForm)).toMatchObject({ status: 400 });
  });
});
