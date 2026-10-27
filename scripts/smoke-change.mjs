// The change loop of the live smoke check, kept apart so smoke.mjs stays under the line cap.
// Every request is a form-twin POST, so no model is called. The venue is booked first because
// a venue only needs re-confirmation once it has agreed to a date and a guest count.
const DAY = 86_400_000;

/** The plan token in a 303 Location, with an optional sub-page, or null. */
function tokenIn(res, sub) {
  const location = res.headers.get('location') ?? '';
  const pattern = new RegExp(`^/en/p/([^/?#]+)${sub}(?:#[a-z-]+)?$`);
  return res.status === 303 ? (pattern.exec(location)?.[1] ?? null) : null;
}

const planHeading = (html) => /<h1[^>]*>\s*(Plan v\d+)/.exec(html)?.[1] ?? null;

/**
 * @param {{call: Function, check: Function, origin: string, token: string | null, eventDate: string}} run
 */
export async function runChangeChecks({ call, check, origin, token, eventDate }) {
  const post = (path, form) => call(path, { method: 'POST', form, headers: { origin } });
  const state = { booked: null, bookedHeading: null, revision: null };

  await check('POST /en/task (form twin) books the venue and answers 303', async () => {
    if (token === null) return { ok: false, detail: 'no plan link from the brief check' };
    const res = await post('/en/task', {
      token,
      taskId: 'book-venue',
      event: 'done',
      amountInr: '150000',
      capacity: '250',
    });
    state.booked = tokenIn(res, '');
    const page = state.booked === null ? null : await call(`/en/p/${state.booked}`);
    state.bookedHeading = planHeading(page?.text ?? '');
    return {
      ok: state.booked !== null && state.bookedHeading !== null,
      detail: state.booked === null ? `status ${res.status || res.error}` : '',
    };
  });

  await check('POST /en/enter/change (form twin) answers 303 to the revision page', async () => {
    if (state.booked === null) return { ok: false, detail: 'no booked plan to change' };
    const earlier = new Date(Date.parse(eventDate) - 14 * DAY).toISOString().slice(0, 10);
    // Untouched fields are sent as a browser sends them: text empty, radios on "No change".
    const untouched = Object.fromEntries(
      [
        'moveAmount',
        'moveTo',
        ...['Venue', 'Catering', 'Decor', 'Photo', 'Music', 'Invites', 'Contingency'].map(
          (each) => `priority${each}`,
        ),
      ].map((name) => [name, '']),
    );
    const res = await post('/en/enter/change', {
      token: state.booked,
      guests: '250',
      budget: '700000',
      eventDate: earlier,
      ...untouched,
    });
    state.revision = tokenIn(res, '/revision');
    return {
      ok: state.revision !== null,
      detail: state.revision === null ? `status ${res.status || res.error}` : '',
    };
  });

  await check('Revision page shows the diff and a venue re-confirmation item', async () => {
    if (state.revision === null) return { ok: false, detail: 'no revision link' };
    const { status, text } = await call(`/en/p/${state.revision}/revision`);
    const diff = text.includes('id="diff-table"');
    // Scoped to the section and to the venue's own list item, so a stray "Venue" in the Undo form
    // or the footer, or another vendor needing re-confirmation, cannot pass the check.
    const section = /<section id="reconfirm"[\s\S]*?<\/section>/.exec(text)?.[0] ?? '';
    const venueItem = /<li[^>]*>\s*<p[^>]*font-semibold[^>]*>\s*Venue[\s\S]*?<\/li>/i.exec(section);
    const item = venueItem !== null && venueItem[0].includes('Needs re-confirmation');
    return {
      ok: status === 200 && diff && item,
      detail:
        status === 200 && diff && item ? '' : `status ${status}, diff ${diff}, venue item ${item}`,
    };
  });

  await check('POST /en/undo answers 303 and the booked plan is back', async () => {
    if (state.revision === null) return { ok: false, detail: 'no revision to undo' };
    const res = await post('/en/undo', { token: state.revision });
    const back = tokenIn(res, '');
    const page = back === null ? null : await call(`/en/p/${back}`);
    const heading = planHeading(page?.text ?? '');
    const html = page?.text ?? '';
    // The heading proves the op was popped; the figures prove the content came back.
    const budget = /Rs\s*8,00,000/.test(html) && !/Rs\s*7,00,000/.test(html);
    const ok = heading !== null && heading === state.bookedHeading && page.status === 200 && budget;
    return {
      ok,
      detail: ok
        ? ''
        : `status ${res.status || res.error}, heading ${heading} vs ${state.bookedHeading}, budget restored ${budget}`,
    };
  });
}
