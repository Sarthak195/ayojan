#!/usr/bin/env node
// Smoke check for a deployed Ayojan. Usage: node scripts/smoke.mjs [base-url]
// Needs a live URL, so it is deliberately not part of `verify` or CI. It makes no model call:
// the plan is reached through the form twin (POST /enter/brief), and no /read route is hit.
// A check that fails today because the feature has not shipped is reported as a failure, never
// loosened to pass.
const DEFAULT_URL = 'https://ayojan-626015685685.asia-south1.run.app';
const base = process.argv[2] ?? DEFAULT_URL;
if (!/^https?:\/\//.test(base)) {
  console.error('usage: node scripts/smoke.mjs [base-url]');
  process.exit(2);
}
const origin = new URL(base).origin;
const TIMEOUT_MS = 20_000;

const results = [];
function record(name, ok, detail = '') {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === '' ? '' : ` (${detail})`}`);
}

/** One request that never follows redirects, so a 303 can be read as it is. */
async function call(path, { method = 'GET', form, headers = {} } = {}) {
  const init = { method, redirect: 'manual', headers, signal: AbortSignal.timeout(TIMEOUT_MS) };
  if (form !== undefined) {
    init.body = new URLSearchParams(form).toString();
    init.headers = { ...headers, 'content-type': 'application/x-www-form-urlencoded' };
  }
  try {
    const response = await fetch(new URL(path, origin), init);
    return { status: response.status, headers: response.headers, text: await response.text() };
  } catch (error) {
    return { status: 0, headers: new Headers(), text: '', error: String(error?.cause ?? error) };
  }
}

/** Runs a check; an exception is a failure of that check, not of the whole run. */
async function check(name, run) {
  try {
    const outcome = await run();
    record(name, outcome.ok, outcome.detail);
  } catch (error) {
    record(name, false, `threw ${String(error)}`);
  }
}

const entities = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'" };
const titleOf = (html) => {
  const raw = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '';
  return raw.replace(/&(?:amp|lt|gt|quot|#x27);/g, (each) => entities[each]).trim();
};

const day = 86_400_000;
const eventDate = new Date(Date.now() + 120 * day).toISOString().slice(0, 10);
const FORM = {
  occasion: 'wedding',
  budget: '8 lakh',
  guests: '200',
  eventDate,
  venueCapacity: '250',
  functionHaldi: 'unsure',
  functionMehndi: 'unsure',
  functionSangeet: 'unsure',
  functionWedding: 'unsure',
  functionReception: 'unsure',
  priorityVenue: 'standard',
  priorityCatering: 'standard',
  priorityDecor: 'standard',
  priorityPhoto: 'standard',
  priorityMusic: 'standard',
  priorityInvites: 'standard',
  priorityContingency: 'standard',
};

console.log(`Smoke check of ${origin}`);

await check('GET /api/health is 200 and ok', async () => {
  const res = await call('/api/health');
  let report = null;
  try {
    report = JSON.parse(res.text);
  } catch {
    // Left null: the check reports the status and the body is not JSON.
  }
  const ok = res.status === 200 && report?.status === 'ok';
  return {
    ok,
    detail: ok ? '' : `status ${res.status || res.error}, body status ${report?.status}`,
  };
});

const pages = {};
for (const lang of ['en', 'hi']) {
  await check(`GET /${lang} is 200`, async () => {
    pages[lang] = await call(`/${lang}`);
    const { status, error } = pages[lang];
    return { ok: status === 200, detail: status === 200 ? '' : `status ${status || error}` };
  });
}

// Filled in by the plan checks below, so the title check can include the plan page too.
const plan = { token: null, html: '' };

const titleCheck = 'Page titles are non-empty and distinct (/en, /hi, plan page)';

// Security headers on the start page; the policy must carry a per-request nonce for scripts.
await check('Content-Security-Policy has a script nonce', async () => {
  const policy = pages.en?.headers.get('content-security-policy') ?? '';
  const scriptSrc = /(?:^|;)\s*script-src([^;]*)/.exec(policy)?.[1] ?? '';
  const ok = /'nonce-[A-Za-z0-9+/=_-]{16,}'/.test(scriptSrc);
  return { ok, detail: ok ? '' : policy === '' ? 'header missing' : 'no nonce in script-src' };
});
// Exact values, so a weakened header on the deployed response (max-age=0, unsafe-none) fails.
const EXPECTED_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
};
for (const [name, expected] of Object.entries(EXPECTED_HEADERS)) {
  await check(`${name} header is ${expected} on /en`, async () => {
    const value = pages.en?.headers.get(name) ?? '';
    return { ok: value === expected, detail: `got ${value === '' ? 'nothing' : value}` };
  });
}
await check('Permissions-Policy header is present on /en', async () => {
  const value = pages.en?.headers.get('Permissions-Policy') ?? '';
  return { ok: value !== '', detail: value === '' ? 'header missing' : '' };
});

await check('POST /en/enter/brief (form twin) answers 303 to /en/p/<token>', async () => {
  const res = await call('/en/enter/brief', {
    method: 'POST',
    form: FORM,
    headers: { origin },
  });
  const location = res.headers.get('location') ?? '';
  const token = /^\/en\/p\/([^/?#]+)$/.exec(location)?.[1] ?? null;
  const ok = res.status === 303 && token !== null;
  plan.token = token;
  return {
    ok,
    detail: ok ? '' : `status ${res.status || res.error}, location ${location.slice(0, 60)}`,
  };
});

await check('Plan page is 200 with the plan heading and the budget figure', async () => {
  if (plan.token === null) return { ok: false, detail: 'no plan link from the previous check' };
  const res = await call(`/en/p/${plan.token}`);
  plan.html = res.text;
  const heading = /<h1[^>]*>\s*Plan v\d+/.test(res.text);
  // Rs 8 lakh, grouped the Indian way; the space may be a no-break space.
  const budget = /Rs\s*8,00,000/.test(res.text);
  const ok = res.status === 200 && heading && budget;
  return {
    ok,
    detail: ok ? '' : `status ${res.status || res.error}, heading ${heading}, budget ${budget}`,
  };
});

await check(titleCheck, async () => {
  const titles = {
    en: titleOf(pages.en?.text ?? ''),
    hi: titleOf(pages.hi?.text ?? ''),
    plan: titleOf(plan.html),
  };
  const values = Object.values(titles);
  const ok = values.every((t) => t !== '') && new Set(values).size === values.length;
  return { ok, detail: ok ? '' : `titles ${JSON.stringify(titles)}` };
});

await check('A damaged plan token answers 404', async () => {
  const token = plan.token ?? 'x'.repeat(200);
  const middle = Math.floor(token.length / 2);
  const swapped = token[middle] === 'A' ? 'B' : 'A';
  const damaged = token.slice(0, middle) + swapped + token.slice(middle + 1);
  const res = await call(`/en/p/${damaged}`);
  return {
    ok: res.status === 404,
    detail: res.status === 404 ? '' : `status ${res.status || res.error}`,
  };
});

await check('GET on the POST-only /en/enter/brief answers 405', async () => {
  const res = await call('/en/enter/brief');
  return {
    ok: res.status === 405,
    detail: res.status === 405 ? '' : `status ${res.status || res.error}`,
  };
});

await check('Privacy sentence sits under the read button on /en', async () => {
  const html = pages.en?.text ?? '';
  const button = html.indexOf('Read my brief');
  const hint = /<p[^>]*id="read-hint"[^>]*>([\s\S]*?)<\/p>/.exec(html);
  const text = hint?.[1].replace(/<[^>]*>/g, '') ?? '';
  const ok =
    button !== -1 &&
    hint !== null &&
    hint.index > button &&
    /Gemini/.test(text) &&
    /phone numbers/.test(text);
  return {
    ok,
    detail: ok ? '' : hint === null ? 'no read-hint paragraph' : 'wording or position differs',
  };
});

const failed = results.filter((ok) => !ok).length;
console.log(
  failed === 0
    ? `All ${results.length} checks passed.`
    : `${failed} of ${results.length} checks failed.`,
);
process.exit(failed === 0 ? 0 : 1);
