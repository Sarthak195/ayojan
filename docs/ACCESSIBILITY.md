# Accessibility

Ayojan is meant to work for people on a small phone, a slow connection, a screen reader, a
keyboard, a dark theme, or a browser with JavaScript switched off, and for people who think and
write in Hindi, English or a mix of the two. This page says what is built in, how it was
tested, and what is still open. It claims no formal conformance level: the checks below are
automated and tool-based, and the gaps section lists what they cannot show.

## What is built in

### Structure and navigation

- **One `h1` per page.** The product name in the header is a link, never a heading, so each
  page owns its single `h1` ([site-header.tsx](../src/components/layout/site-header.tsx)).
  Sections below it use `h2` with `aria-labelledby`.
- **Landmarks.** Every page has a `header`, a `main` and a `footer`
  ([layout.tsx](../src/app/layout.tsx)). The language switch is a labelled `nav`, and the plan
  page adds a labelled "jump to" `nav` for its sections.
- **Skip link first.** "Skip to main content" is the first focusable element and moves focus to
  `main` ([skip-link.tsx](../src/components/layout/skip-link.tsx)). It is hidden until it
  receives focus.
- **Visible focus.** Every focusable element gets a 3 px outline from a theme colour
  ([globals.css](../src/app/globals.css)). The only outline removed is the one on `main`, which
  takes focus from the skip link and is not a control.
- **Zoom is never blocked.** The viewport meta tag is `width=device-width, initial-scale=1`,
  with no `maximum-scale` and no `user-scalable=no`.

### Language

- **Path locales.** The page language is the first part of the URL, `/en` or `/hi`, so it
  survives a shared WhatsApp link and works without JavaScript. The proxy passes the language
  to the root layout, which writes `<html lang>`, so the attribute matches the page
  ([proxy.ts](../src/proxy.ts)). The same holds for the pages the server builds by hand for
  errors ([problem-page.ts](../src/server/http/problem-page.ts)).
- **Language switch.** The other language is a plain link to the same page with the same link
  token ([language-switch.tsx](../src/components/layout/language-switch.tsx)). Each language
  name carries its own `lang` attribute.
- **Hindi interface.** Every user-facing string exists in English and Hindi. Both are
  typed against the same interface for each area, so a missing Hindi key fails the type check, and the
  planning data (tasks, levers, questions) requires both languages on every label
  ([dictionary.ts](../src/i18n/dictionary.ts),
  [planning-row.ts](../src/schemas/data/planning-row.ts)).
- **Hinglish and Devanagari input.** The brief box accepts Hindi, English or Hinglish, and says
  so next to the field. Quotes that the model returns are checked against the user's own words
  and are never translated, so what is shown can still be found in what was typed.
- **Numbers.** Amounts use Western digits with lakh and crore grouping in both languages
  (for example `Rs 7,50,000`), written by hand so they are the same in every runtime
  ([format.ts](../src/core/rupees/format.ts)).

### Colour is never the only signal

- **Status is a word plus a shape.** Done, Late, At risk, Due this week and On track each show
  the word and an icon with its own silhouette (check, octagon, triangle, clock, circle). The
  icon is hidden from assistive technology because the word carries the meaning, and colour is
  a third, redundant cue ([status-word.tsx](../src/components/status/status-word.tsx),
  [icon.tsx](../src/components/status/icon.tsx)).
- **Where a figure comes from is text.** Every money figure carries a written label for its
  source, and errors in forms are sentences next to the field, not a red border.
- **Dark mode.** The colour tokens are redefined under `prefers-color-scheme: dark`, including
  the focus ring and the status colours. There is no theme toggle: the page follows the system
  setting. The small stylesheet on the server-built error pages does the same.

### Forms

- Every input has a visible `<label>`; no placeholder stands in for one. Hints and errors are
  tied to the field with `aria-describedby`, and an invalid field is marked `aria-invalid`
  ([fields.tsx](../src/components/form/fields.tsx)).
- Radio and checkbox groups are `fieldset` elements with a `legend`
  ([choice-group.tsx](../src/components/form/choice-group.tsx)).
- Amount and count fields use `inputmode="numeric"`, so a phone opens the number pad.
- On the start page the read buttons are described by a sentence saying that reading can take
  a while, so the wait is announced with the button.

### Tables

- Tables are real tables with a `caption` and `scope` on header cells. On a narrow screen they
  stay tables and scroll sideways inside a region that has `role="region"`, `tabindex="0"` and
  `aria-labelledby` pointing at the caption ([scroll-table.tsx](../src/components/table/scroll-table.tsx)).
  Turning rows into cards with CSS would strip the table semantics in some browsers, so it is
  not done. The caption is pinned to the left edge of the region so its sentence stays readable
  while the columns scroll.

### Announcements after a submit

- Every step is a form POST that answers a 303 redirect. The redirect lands on the changed
  section (`#tasks`, `#change-form`, `#quote-form`), and that section opens with a
  `role="status"` sentence saying what happened, such as the new plan version and whether the
  plan is over budget ([status-summary.tsx](../src/components/layout/status-summary.tsx),
  [see-other.ts](../src/server/http/see-other.ts)). A screen reader announces it without focus
  moving. The sentence is computed from the plan, so no user text travels in the redirect.
- Reload and the back button are safe, because the state is in the link and the POST is
  answered by a redirect.

### Touch targets and motion

- Buttons, inputs, checkbox rows, summaries and the navigation and skip links have a minimum
  height of 44 px (`min-h-11`).
- There are no animations. The stylesheet also collapses animation, transition and smooth
  scrolling under `prefers-reduced-motion: reduce`. No JavaScript in the repository animates
  anything.

### Works without JavaScript

- The whole loop (describe the event, check the reading, see the plan, mark tasks, add a quote,
  change a number, preview and apply levers, undo) is plain HTML forms
  posting to fixed routes and answered with a 303. The server tests drive it with urlencoded
  POSTs only ([tests/http](../tests/http)).
- There are two small client components, both enhancements:
  [running-total.client.tsx](../src/components/islands/running-total.client.tsx) updates the
  "Selected saves Rs X" line as boxes are ticked (without JavaScript, the Recalculate button
  refreshes the same line), and
  [copy-button.client.tsx](../src/components/islands/copy-button.client.tsx) adds a Copy button
  (without JavaScript it renders nothing and the page says "Select the text to copy it.").
- **If the AI reader is unavailable**, the user gets a form with the same fields and an
  explanation of why, and the plan is computed the same way. A model outage does not block the
  plan.

### Low-end phones and patchy data

- System fonts only, which include Devanagari on current phones. No web fonts, no raster
  images, no third-party scripts, styles or hosts. Icons are small inline SVG paths.
- The layout is built for a 360 px screen first.
- Page weight on the wire is small. The plan page is 15.4 KiB of gzip HTML, and every page
  carries about 132 KiB of gzip JavaScript, which is the React and Next runtime. The damaged-link
  page ships none. These come from
  [scripts/measure-pages.mjs](../scripts/measure-pages.mjs) run against a local production
  build of commit `6a71328` on 26 October 2026.

## How it is tested

### Automated: axe-core in the test suite

[tests/a11y/axe.test.ts](../tests/a11y/axe.test.ts) renders the real pages and routes in
process, wraps each in the same shell the root layout builds (skip link, header, `main`,
footer), loads the result into jsdom, and runs axe-core 4.14.0 on it, in both `en` and `hi`.

It covers 12 page states: the start page, the form twin, the form twin after a failed read,
the check page for a brief, a quote and a change, the plan, an over-budget plan, the quotes
page, the revision page with levers, the revision page after a change, and the messages page.
It also renders all 13 problem pages (not found, damaged link, link full, operation cap, too
many requests, wrong type, too large, malformed, text too long, cannot apply, nothing to undo,
nothing pending, server error). That is 25 renderings per language.

The test has three cases: one that axe does flag a missing image alt (so a clean run means
something), and one per language that expects no violations and an `h1` on every view. Result
on 26 October 2026: 3 passed, no violations. Because jsdom computes no layout, the
`color-contrast` rule is switched off in this test and checked in a browser instead (below).

### Manual and tool runs on 26 October 2026

These ran in Chrome against a local copy of the production build of commit `f694edb`, with no
Gemini key (so no model call), unless a line says otherwise.

| Check                                                                                               | Result                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lighthouse accessibility (desktop, snapshot mode)                                                   | 100 on the start page, form, check page, plan, quotes, revision with levers, messages, and the Hindi plan. No failed audit on any of them.                                                                                                                                                                                                                                                                              |
| axe-core in Chrome with contrast (tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice) | 0 violations and 0 incomplete on 11 views in English and 11 in Hindi (start, form, three check pages, plan, over-budget plan, quotes, revision, revision after a change, messages), in the light scheme and in the emulated dark scheme.                                                                                                                                                                                |
| 360 px width (emulated 360 by 740, device scale 2, mobile)                                          | All 22 views have a document width of 360 px, equal to the window, and nothing sticks out of the viewport except inside the table scroll regions. Money, comparison and diff tables scroll 512 px inside 326 px.                                                                                                                                                                                                        |
| Keyboard                                                                                            | On the plan page a real Tab put focus on the skip link first, and Enter moved focus to `main`. The plan page has 120 focus stops, none with a positive `tabindex`, in document order. The revision page has 21 stops in a sensible order (skip link, home, language, seven lever checkboxes each with its "Why this number?" summary, Recalculate, Apply, Undo, back to the plan). Every control showed the focus ring. |
| No JavaScript                                                                                       | Every step was run as a plain HTTP form and every 303 followed by hand: start, form, brief to plan v1, mark a task done with an amount, add a quote, change guests and budget, apply levers, undo, and the messages page. All worked.                                                                                                                                                                                   |
| Hydration on the live site (revision `ayojan-00001-jxf`, no model call)                             | With the live Content Security Policy in place, the revision page of an over-budget plan loaded all its scripts, hydrated the running-total line, and updated it on two checkbox ticks (404,000 over budget, minus 57,750 saved, read 3,46,250 over budget). The only console message was a 404 for `/favicon.ico` (fixed in `f51ab58`, live since `ayojan-00002-7hr`): no policy violation and no hydration error.     |

Screenshots were reviewed for the start page, form, plan, quotes, revision levers, messages, the
Hindi plan and the revision diff table at 360 px. The check page and the long plan page were too
tall to judge from a screenshot and were judged from the numbers above.

### Other tests that bear on accessibility

- [tests/unit/components](../tests/unit/components): the skip link targets `main`; the header
  has no heading; the language switch links to the same page and marks the current language;
  each status has its word and a hidden icon, and all five icons differ; tables are labelled
  focusable regions with scoped headers; the status summary has `role="status"`; hints and
  errors are tied to inputs; choices sit in a fieldset with a legend.
- [tests/unit/i18n](../tests/unit/i18n): both languages have the same keys in every area, no
  text is empty, and the Hindi is in Devanagari.

## Known gaps

These are open as of 26 October 2026, unless marked fixed.

- **No hand test with a screen reader.** Nobody ran NVDA, JAWS, VoiceOver or TalkBack over the
  app. The semantics are checked by axe and Lighthouse and by reading the markup, which finds
  missing names and roles but not whether the page is pleasant to listen to. For the same reason
  the `role="status"` announcements after a submit are specified and tested as markup, not heard.
- **Hindi is machine-assisted.** The Hindi interface and the Hindi labels in the planning data
  were written and reviewed with AI assistance, in everyday
  Hindustani. A professional translator has not reviewed them. Expect some stiff or unnatural
  phrasing.
- **Contrast is checked by tools, in a browser, once.** The axe contrast run above covers 11
  views in each language and both colour schemes, but not every state (for example every error
  and banner variant). jsdom cannot measure contrast, so the in-repo test does not.
- **The server-built error pages are not in the browser runs.** The axe test renders the problem
  pages through the React view that the not-found pages use. The pages that routes answer with
  directly (damaged link, too many requests, wrong type and similar) are built from a separate
  small HTML template, which has the same text and structure but has no axe run of its own.
- **Not tested on real devices.** The 360 px results are Chrome device emulation. No real low-end
  Android phone, no throttled network, and no Windows high-contrast or forced-colours mode.
  Lighthouse was run in desktop mode.
- **The numbers in the Lighthouse and 360 px rows are for commit `f694edb`.** Later commits have
  had the automated axe test, but not these browser runs.
- ~~Table captions ran off the right edge at 360 px until the region was scrolled.~~ **Fixed**
  in `31a0528` (caption pinned to the region's left edge). Re-measured on the live revision
  `ayojan-00002-7hr` in Chromium at 360 px: with the plan page's money table scrolled 120 px, the
  caption stayed at 17 to 337 px. The quotes and revision tables use the same component but were
  not re-measured.
- Small defects found on 26 October 2026, all fixed the same day and live since revision
  `ayojan-00002-7hr`:
  - ~~On the Hindi plan page the "left in the budget" label is shown with a doubled colon.~~
    **Fixed** in `5abb5f9`.
  - ~~The browser asks for `/favicon.ico` and gets a 404, which is the one console error on every
    first visit.~~ **Fixed** in `f51ab58` (a small text SVG icon).
  - ~~Without JavaScript, typing grouped digits such as `1,80,000` in the "amount booked" field
    answers with a "could not be read" page.~~ **Fixed** in `adb3338`: whole-number fields accept
    lakh grouping.
- **Reading level is a design aim, not a measurement.** Strings are short and avoid internal
  terms, but no readability score is computed or tested.
- **The no-JavaScript claim is about the core loop.** The running-total line and the Copy button
  need JavaScript to be live. The sentence and the "select the text" instruction stand without it.
