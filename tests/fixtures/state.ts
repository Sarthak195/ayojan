import { deflateRawSync } from 'node:zlib';

import { leverIds, taskIds } from '@/schemas/generated/ids';
import type { Brief, ReadBy } from '@/schemas/plan/brief';
import { MAX_OPS, type Op } from '@/schemas/plan/op';
import type { QuoteRecord } from '@/schemas/plan/quote-record';
import { SHORT_TEXT_MAX_BYTES, utf8ByteLength } from '@/schemas/plan/short-text';
import { MAX_DISPLAY_QUOTES, type StateToken } from '@/schemas/plan/state-token';
import { categories } from '@/schemas/readings/vocabulary';

// Every builder starts its own seeded source, so a state's sealed length is the same on every
// run and in any test order, and token-size.test.ts can pin it.
function randomSource(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * `words` draws real Hindi wedding words, the realistic case; `syllables` draws random
 * consonant and vowel-sign pairs, which deflate cannot shrink much, the adversarial bound.
 */
export type TextStyle = 'words' | 'syllables';

const HINDI_WORDS = (
  'शादी मेहमान बजट खाना लाख हज़ार हल्दी मेहंदी संगीत रिसेप्शन फ़रवरी मार्च पहले बाद बढ़ेंगे कम ' +
  'ज़्यादा डेकोर फोटो कैटरर प्लेट थाली मिठाई सलाद काउंटर लाइव ढोल बैंड बुकिंग एडवांस शामिल अलग ' +
  'जीएसटी शाकाहारी जैन शराब नहीं बुज़ुर्ग बच्चे व्हीलचेयर वेन्यू हॉल लोग रुपये दो तीन चार पांच ' +
  'हफ़्ते दिन रात बजे बंद ज़रूर चाहिए करना है होगा और भी'
).split(' ');
const ENGLISH_WORDS = (
  'live chaat counter tandoor sweets salad welcome drink mandap stage lights flowers ' +
  'generator valet chairs tables dhol band sound album drone invites boxes'
).split(' ');

interface Texts {
  short: () => string;
  label: () => string;
  int: (min: number, max: number) => number;
}

function texts(seed: number, style: TextStyle, asciiLabels = false): Texts {
  const next = randomSource(seed);
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));
  const from = (list: readonly string[]): string => list[int(0, list.length - 1)] ?? '';
  const syllable = (): string =>
    String.fromCodePoint(0x0915 + int(0, 36)) + String.fromCodePoint(0x093e + int(0, 14));
  // Fills to a limit: bytes for display quotes (D31), UTF-16 units for labels (Zod `.max`).
  const fill = (fits: (text: string) => boolean, piece: () => string, sep: string): string => {
    let text = '';
    for (;;) {
      const longer = text === '' ? piece() : text + sep + piece();
      if (!fits(longer)) return text;
      text = longer;
    }
  };
  const words = style === 'words';
  return {
    int,
    short: () =>
      fill(
        (t) => utf8ByteLength(t) <= SHORT_TEXT_MAX_BYTES,
        words ? () => from(HINDI_WORDS) : syllable,
        words ? ' ' : '',
      ),
    label: () =>
      asciiLabels
        ? fill(
            (t) => t.length <= 40,
            () => from(ENGLISH_WORDS),
            ' ',
          )
        : fill((t) => t.length <= 40, words ? () => from(HINDI_WORDS) : syllable, words ? ' ' : ''),
  };
}

const readBy = (t: Texts): ReadBy => ({
  source: 'ai',
  model: 'gemini-3.5-flash-lite',
  matched: t.int(10, 30),
  total: 30,
});

const allPriorities = (): Brief['priorities'] => ({
  venue: 'more',
  catering: 'unclear',
  decor: 'more',
  photo: 'unclear',
  music: 'more',
  invites: 'unclear',
  contingency: 'more',
});

function fullBrief(t: Texts): Brief {
  return {
    occasion: 'wedding',
    budgetInr: t.int(5_000, 100_000_000),
    guests: t.int(1, 5_000),
    eventDate: '2027-02-20',
    venueCapacity: t.int(1, 5_000),
    functions: { haldi: 'yes', mehndi: 'unsure', sangeet: 'yes', wedding: 'yes', reception: 'no' },
    priorities: allPriorities(),
    mustHaves: ['dhol', 'mehndiArtist', 'liveCounter', 'choreographer'],
    needs: ['elderly', 'children', 'wheelchair'],
    diet: ['vegOnly', 'jain', 'noAlcohol'],
    venueLimits: ['indoorOnly', 'musicCurfew'],
    notes: Array.from({ length: 6 }, t.short),
  };
}

function fullQuote(t: Texts, id: QuoteRecord['id']): QuoteRecord {
  return {
    id,
    category: 'catering',
    basis: 'perPlate',
    rateInr: t.int(100, 5_000),
    minimumGuests: t.int(1, 5_000),
    guestsCovered: t.int(1, 5_000),
    tax: 'extraWithRate',
    taxBasisPoints: 1_800,
    extras: Array.from({ length: 4 }, (_, i) => ({
      key: i === 0 ? ('liveCounter' as const) : ('other' as const),
      label: t.label(),
      amountInr: t.int(1_000, 500_000),
    })),
    inclusions: Array.from({ length: 4 }, t.label),
    advancePercent: t.int(0, 100),
  };
}

function fullChange(t: Texts, n: number): Op {
  return {
    kind: 'changeConfirmed',
    guests: t.int(1, 5_000),
    budgetInr: t.int(5_000, 100_000_000),
    eventDate: `2027-0${String(1 + (n % 9))}-${String(10 + (n % 18))}`,
    reallocate: { to: 'catering', amountInr: t.int(1_000, 1_000_000) },
    priorities: allPriorities(),
    sources: Array.from({ length: 3 }, t.short),
    readBy: readBy(t),
  };
}

// The small ops that make up most of a real session.
function smallOp(t: Texts, n: number): Op {
  const taskId = taskIds[n % taskIds.length] ?? taskIds[0];
  if (n % 3 === 0) return { kind: 'taskDelayed', taskId, notBefore: '2026-12-15' };
  if (n % 3 === 1) {
    return {
      kind: 'taskDone',
      taskId,
      on: '2026-11-02',
      amountInr: t.int(0, 900_000),
      capacity: null,
    };
  }
  return { kind: 'leversApplied', leverIds: [...leverIds], raiseBudgetInr: t.int(0, 900_000) };
}

function pendingBrief(t: Texts): NonNullable<StateToken['pending']> {
  const brief = fullBrief(t);
  return {
    kind: 'brief',
    values: { ...brief, budgetInr: brief.budgetInr, guests: brief.guests },
    fields: Array.from({ length: MAX_DISPLAY_QUOTES }, (_, i) => ({
      field: `priorities.${categories[i % categories.length] ?? 'venue'}`,
      status: 'unverified' as const,
      reason: 'number-not-in-quote' as const,
      displayQuote: t.short(),
    })),
    readBy: readBy(t),
  };
}

const SLOTS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

function withQuotes(t: Texts, ops: Op[], count: number): void {
  for (const id of SLOTS.slice(0, count))
    ops.push({ kind: 'quoteAdded', quote: fullQuote(t, id), readBy: readBy(t) });
}

/**
 * S1, the schema maximum: the brief, six full quotes, every other op a full change (the
 * largest op after the brief), and a pending brief reading with 16 display quotes, every
 * text at its limit in Devanagari.
 */
export function worstCaseState(opCount: number = MAX_OPS, style: TextStyle = 'words'): StateToken {
  const t = texts(1, style);
  const ops: Op[] = [{ kind: 'briefConfirmed', brief: fullBrief(t), readBy: readBy(t) }];
  withQuotes(t, ops, Math.min(6, opCount - 1));
  while (ops.length < opCount) ops.push(fullChange(t, ops.length));
  return { schema: 1, ops, pending: pendingBrief(t) };
}

/**
 * S2, the spec's reading of the worst case (arch 6.1, "several full changes"): the brief, six
 * full quotes, five full changes, small ops up to the cap, and the 16-quote pending reading.
 * S3 is the same with ASCII quote labels.
 */
export function specWorstState(style: TextStyle = 'words', asciiLabels = false): StateToken {
  const t = texts(2, style, asciiLabels);
  const ops: Op[] = [{ kind: 'briefConfirmed', brief: fullBrief(t), readBy: readBy(t) }];
  withQuotes(t, ops, 6);
  for (let i = 0; i < 5; i += 1) ops.push(fullChange(t, i));
  while (ops.length < MAX_OPS) ops.push(smallOp(t, ops.length));
  return { schema: 1, ops, pending: pendingBrief(t) };
}

/**
 * S4, a plausible full session: the brief, two quotes, two changes, ten bookings, three
 * delays, one lever choice (19 ops), and a pending change reading with three quotes.
 */
export function typicalSessionState(): StateToken {
  const t = texts(4, 'words');
  const ops: Op[] = [{ kind: 'briefConfirmed', brief: fullBrief(t), readBy: readBy(t) }];
  withQuotes(t, ops, 2);
  ops.push(fullChange(t, 0), fullChange(t, 1));
  for (let i = 0; i < 10; i += 1) ops.push(smallOp(t, 3 * i + 1));
  for (let i = 0; i < 3; i += 1) ops.push(smallOp(t, 3 * i));
  ops.push(smallOp(t, 2));
  const sources = Array.from({ length: 3 }, t.short);
  return {
    schema: 1,
    ops,
    pending: {
      kind: 'change',
      values: {
        guests: { mode: 'delta', count: 50 },
        budget: null,
        dateCandidates: ['2027-02-06'],
        reallocate: { to: 'catering', amountInr: 40_000 },
        sources,
      },
      fields: sources.map((displayQuote, i) => ({
        field: ['guests', 'dateShift', 'reallocate'][i] ?? 'guests',
        status: 'verified' as const,
        reason: null,
        displayQuote,
      })),
      readBy: readBy(t),
    },
  };
}

/** A small state to round-trip: the brief, one booking and one lever choice. */
export function smallState(): StateToken {
  const t = texts(5, 'words');
  return {
    schema: 1,
    ops: [
      { kind: 'briefConfirmed', brief: fullBrief(t), readBy: readBy(t) },
      { kind: 'taskDone', taskId: taskIds[0], on: '2026-11-02', amountInr: 250_000, capacity: 300 },
      { kind: 'leversApplied', leverIds: [leverIds[0]], raiseBudgetInr: null },
    ],
  };
}

/**
 * About 1 KiB of raw deflate that inflates to 1 MiB of spaces: small enough that its sealed
 * token passes the length check, so the inflate guard itself is what must stop it.
 */
export function inflateBomb(): Buffer {
  return deflateRawSync(Buffer.alloc(1024 * 1024, 0x20), { level: 9 });
}
