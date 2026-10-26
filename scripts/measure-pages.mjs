#!/usr/bin/env node
// Page-weight measurement (D23: published, never gated). Usage:
//   node scripts/measure-pages.mjs http://127.0.0.1:3200 [--json]
// Point it at a production server (the standalone build) that has no model key: every page
// is reached through the form twin (POST /enter/brief), so no model call is made. Sizes are
// bytes of the decoded body. gzip uses zlib's default level and brotli its default quality,
// which is an upper bound on what a tuned server would send; the server's own encoding is
// reported separately because that is what a phone actually downloads.
import http from 'node:http';
import https from 'node:https';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const base = process.argv[2];
const asJson = process.argv.includes('--json');
if (base === undefined || !/^https?:\/\//.test(base)) {
  console.error('usage: node scripts/measure-pages.mjs <base-url> [--json]');
  process.exit(2);
}
const origin = new URL(base).origin;

/** One request; identity encoding unless told otherwise, so the body is the raw bytes. */
function request(path, { method = 'GET', form, encoding = 'identity' } = {}) {
  const url = new URL(path, origin);
  const body = form === undefined ? undefined : new URLSearchParams(form).toString();
  const headers = { 'accept-encoding': encoding };
  if (body !== undefined) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    headers['content-length'] = String(Buffer.byteLength(body));
  }
  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(url, { method, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }),
      );
    });
    req.on('error', reject);
    req.end(body);
  });
}

function sizes(buffer) {
  return {
    raw: buffer.length,
    gzip: gzipSync(buffer).length,
    br: brotliCompressSync(buffer).length,
  };
}

const sum = (list) =>
  list.reduce((a, s) => ({ raw: a.raw + s.raw, gzip: a.gzip + s.gzip, br: a.br + s.br }), {
    raw: 0,
    gzip: 0,
    br: 0,
  });

/** Form defaults from the page itself: checked radios and typed values, then our overrides. */
function formFields(html, overrides) {
  const fields = {};
  const seen = new Set();
  for (const [tag] of html.matchAll(/<input\b[^>]*>/g)) {
    const attr = (name) => new RegExp(`\\s${name}=(?:"([^"]*)"|(?=[\\s/>]))`).exec(tag);
    const name = attr('name')?.[1];
    const type = attr('type')?.[1] ?? 'text';
    const value = attr('value')?.[1] ?? '';
    if (name === undefined || type === 'checkbox' || type === 'submit') continue;
    if (type === 'radio') {
      if (attr('checked') !== null) fields[name] = value;
      else if (!seen.has(name)) fields[name] = value;
      seen.add(name);
    } else fields[name] = value;
  }
  return { ...fields, ...overrides };
}

const day = 86_400_000;
const eventDate = new Date(Date.now() + 120 * day).toISOString().slice(0, 10);
const VALID = { occasion: 'wedding', budget: '8 lakh', guests: '200', eventDate };
const NEEDS_QUESTION = { ...VALID, budget: '4999' };

async function enter(lang, overrides) {
  const form = (await request(`/${lang}/form`)).body.toString('utf8');
  const response = await request(`/${lang}/enter/brief`, {
    method: 'POST',
    form: formFields(form, overrides),
  });
  const location = response.headers.location;
  if (response.status !== 303 || typeof location !== 'string') {
    throw new Error(`enter/brief answered ${response.status}, not a redirect`);
  }
  return location;
}

/** Scripts and styles a page references, in the order they appear, without repeats. */
function assets(html) {
  const find = (re) => [...new Set([...html.matchAll(re)].map((m) => m[1]))];
  const tags = [...html.matchAll(/<script\b[^>]*\ssrc="([^"]+)"[^>]*>/g)];
  // A noModule script is a polyfill only legacy browsers run; a modern phone never fetches it.
  const legacy = tags.filter((m) => /\snoModule=/.test(m[0])).map((m) => m[1]);
  const scripts = tags.map((m) => m[1]).filter((file) => !legacy.includes(file));
  const preloads = find(/<link\b[^>]*rel="preload"[^>]*as="script"[^>]*href="([^"]+)"/g);
  const styles = find(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g);
  return { js: [...new Set([...scripts, ...preloads])], css: styles, legacy };
}

const fileCache = new Map();
async function fileSizes(path) {
  if (!fileCache.has(path)) {
    const response = await request(path);
    if (response.status !== 200) throw new Error(`${path} answered ${response.status}`);
    fileCache.set(path, { ...sizes(response.body), text: response.body.toString('utf8') });
  }
  return fileCache.get(path);
}

async function measure(label, path, baseline) {
  const response = await request(path);
  const html = response.body;
  const text = html.toString('utf8');
  const { js, css, legacy } = assets(text);
  const jsSizes = await Promise.all(js.map(fileSizes));
  const legacySizes = await Promise.all(legacy.map(fileSizes));
  const cssSizes = await Promise.all(css.map(fileSizes));
  const inline = [...text.matchAll(/<script\b(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  const extra = baseline === undefined ? [] : js.filter((file) => !baseline.has(file));
  return {
    page: label,
    path: path.replace(/\/p\/[A-Za-z0-9_-]{40,}/, '/p/<token>'),
    status: response.status,
    html: sizes(html),
    inlineScriptBytes: inline.reduce((n, m) => n + Buffer.byteLength(m[1]), 0),
    js: { count: js.length, ...sum(jsSizes) },
    css: { count: css.length, ...sum(cssSizes) },
    legacyJs: { count: legacy.length, ...sum(legacySizes) },
    extraJs: extra.map((file) => ({ file, raw: fileCache.get(file).raw })),
    clipboardIsland: js.some((file) => fileCache.get(file).text.includes('clipboard.writeText')),
    jsFiles: js,
  };
}

async function main() {
  const rows = [];
  const home = await measure('/en', '/en');
  const baseline = new Set(home.jsFiles);
  rows.push(home);
  rows.push(await measure('/en/form', '/en/form', baseline));

  rows.push(await measure('check', await enter('en', NEEDS_QUESTION), baseline));
  const plan = await enter('en', VALID);
  rows.push(await measure('plan', plan, baseline));
  const planHtml = (await request(plan)).body.toString('utf8');
  for (const step of ['quotes', 'revision', 'messages']) {
    const link = new RegExp(`href="(${plan.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/${step})"`).exec(
      planHtml,
    );
    if (link === null)
      rows.push({ page: step, path: `${plan}/${step}`, status: 'no link on plan page' });
    else rows.push(await measure(step, link[1], baseline));
  }
  rows.push(await measure('hi plan', await enter('hi', VALID), baseline));
  rows.push(await measure('404 unknown path', '/en/no-such-page', baseline));
  rows.push(await measure('404 damaged link', '/en/p/not-a-real-link', baseline));

  const wire = await request('/en/form', { encoding: 'gzip, br' });
  const encoding = wire.headers['content-encoding'] ?? 'none';
  const wireInfo = { encoding, bytesOnWire: wire.body.length, rawBytes: rows[1].html.raw };
  if (asJson) {
    console.log(
      JSON.stringify({ base: origin, date: new Date().toISOString(), rows, wireInfo }, null, 2),
    );
    return;
  }
  const kb = (n) => (n / 1024).toFixed(1).padStart(6);
  console.log(
    `Page weight, ${origin}, ${new Date().toISOString().slice(0, 10)} (KiB; raw / gzip / brotli)`,
  );
  console.log(
    'page'.padEnd(18) +
      'status  html raw/gz/br          js n  js raw/gz/br          css raw/gz   extra js vs /en (js = modern browser, noModule polyfill apart)',
  );
  for (const r of rows) {
    if (typeof r.status === 'string') {
      console.log(`${r.page.padEnd(18)}${r.status}`);
      continue;
    }
    const extra =
      r.extraJs.length === 0
        ? 'none'
        : r.extraJs.map((e) => `${e.file.split('/').pop()} ${kb(e.raw).trim()}`).join(', ');
    console.log(
      `${r.page.padEnd(18)}${String(r.status).padEnd(8)}${kb(r.html.raw)}${kb(r.html.gzip)}${kb(r.html.br)}   ` +
        `${String(r.js.count).padStart(4)}  ${kb(r.js.raw)}${kb(r.js.gzip)}${kb(r.js.br)}   ` +
        `${kb(r.css.raw)}${kb(r.css.gzip)}   ${extra}${r.clipboardIsland ? ' [copy island present]' : ''}`,
    );
  }
  const poly = rows[0].legacyJs;
  console.log(
    `noModule polyfill (legacy browsers only), not counted above: ${poly.count} file, ${kb(poly.raw).trim()} raw, ${kb(poly.gzip).trim()} gzip.`,
  );
  console.log(
    `Server encoding for Accept-Encoding gzip, br on /en/form: ${wireInfo.encoding}, ${wireInfo.bytesOnWire} bytes on the wire for ${wireInfo.rawBytes} raw.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
