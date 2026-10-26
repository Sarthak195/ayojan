import 'server-only';

import type { z } from 'zod';

import { parseUrlencoded, type FormFields } from './urlencoded';

// Every POST is a plain HTML form (no JavaScript needed), so this is the only body format.
// The order of checks follows arch 6.3. The rate limit (429) is not here: the route calls the
// limiter first and this function only afterwards, which is what keeps a refused request
// from costing a body read.

export const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';
export const MAX_BODY_BYTES = 32 * 1024;
/** Free text past this is a crafted request (the textarea's maxlength stops a browser). */
export const MAX_TEXT_CODE_POINTS = 2_000;

export type FormRefusal = 'wrong-type' | 'too-large' | 'malformed' | 'invalid';

export const REFUSAL_STATUS = {
  'wrong-type': 415,
  'too-large': 413,
  malformed: 400,
  invalid: 422,
} as const satisfies Record<FormRefusal, number>;

export type RefusalStatus = (typeof REFUSAL_STATUS)[FormRefusal];

export interface FormBodyRefusal {
  readonly ok: false;
  readonly reason: FormRefusal;
  readonly status: RefusalStatus;
}

export type FormBodyResult<T> = { readonly ok: true; readonly value: T } | FormBodyRefusal;

/** The parts of a Request this needs; a real Request satisfies it. */
export interface FormRequest {
  readonly headers: Headers;
  readonly body: ReadableStream<Uint8Array> | null;
}

// The sealed state is capped (4,000 characters) and checked by the token codec, so it is
// exempt from the free-text cap, which it would otherwise exceed.
const TEXT_CAP_EXEMPT: ReadonlySet<string> = new Set(['token']);

export function refusal(reason: FormRefusal): FormBodyRefusal {
  return { ok: false, reason, status: REFUSAL_STATUS[reason] };
}

function isFormContentType(header: string | null): boolean {
  if (header === null) return false;
  const [mediaType = '', ...parameters] = header.split(';');
  if (mediaType.trim().toLowerCase() !== FORM_CONTENT_TYPE) return false;
  // Browsers send no charset for this type; one that names anything but UTF-8 is refused
  // rather than misread.
  return parameters.every((parameter) => {
    const [name = '', value = ''] = parameter.split('=');
    if (name.trim().toLowerCase() !== 'charset') return true;
    return value.trim().replaceAll('"', '').toLowerCase() === 'utf-8';
  });
}

/**
 * Reads at most MAX_BODY_BYTES. A declared Content-Length over the cap is refused before a
 * single byte is read; without one (a chunked body) the reader stops and cancels the stream
 * at the first chunk that crosses the cap, so an endless body is never buffered.
 */
async function readCapped(request: FormRequest): Promise<Uint8Array | FormRefusal> {
  const declared = request.headers.get('content-length');
  if (declared !== null) {
    if (!/^\d{1,15}$/.test(declared.trim())) return 'malformed';
    if (Number(declared.trim()) > MAX_BODY_BYTES) return 'too-large';
  }
  if (request.body === null) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return 'too-large';
      }
      chunks.push(value);
    }
  } catch {
    // The client went away or sent a broken stream: nothing usable arrived.
    return 'malformed';
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

// Counted in code points, so a Hindi or emoji-heavy message gets the same allowance as an
// English one. A UTF-16 length within the cap cannot hold more code points, so only longer
// strings are counted, and the body cap bounds that work.
function exceedsTextCap(text: string): boolean {
  if (text.length <= MAX_TEXT_CODE_POINTS) return false;
  let count = 0;
  for (let index = 0; index < text.length; index += 1) {
    // A low surrogate continues the code point its high surrogate started.
    const unit = text.charCodeAt(index);
    if (unit < 0xdc00 || unit > 0xdfff) count += 1;
  }
  return count > MAX_TEXT_CODE_POINTS;
}

function hasOverlongText(fields: FormFields): boolean {
  return Object.entries(fields).some(
    ([name, value]) =>
      !TEXT_CAP_EXEMPT.has(name) &&
      (typeof value === 'string' ? [value] : value).some(exceedsTextCap),
  );
}

/**
 * The form fields of a POST, parsed by the caller's Zod form schema. A failure is a reason
 * plus its status: 415 wrong content type, 413 over 32 KiB, 400 a body that does not decode
 * or does not fit the schema, 422 a well-formed form with free text over 2,000 code points.
 * Never throws for anything the client sent, so a bad body is a 400 page, never a 500.
 */
export async function readForm<S extends z.ZodType>(
  request: FormRequest,
  schema: S,
): Promise<FormBodyResult<z.output<S>>> {
  if (!isFormContentType(request.headers.get('content-type'))) return refusal('wrong-type');
  const bytes = await readCapped(request);
  if (typeof bytes === 'string') return refusal(bytes);
  const text = decodeUtf8(bytes);
  const fields = text === null ? null : parseUrlencoded(text);
  if (fields === null) return refusal('malformed');
  const parsed = schema.safeParse(fields);
  if (!parsed.success) return refusal('malformed');
  if (hasOverlongText(fields)) return refusal('invalid');
  return { ok: true, value: parsed.data };
}
