import 'server-only';

import { z } from 'zod';

import type { IsoDate } from '@/core/calendar/day-number';
import { previewOp } from '@/core/plan/plan-view';
import type { Lang } from '@/i18n/lang';
import type { DataDocuments } from '@/schemas/data/data-files';
import { TokenField } from '@/schemas/forms/form-field';
import { QuoteForm } from '@/schemas/forms/quote-form';
import type { ReadBy } from '@/schemas/plan/brief';
import type { Op } from '@/schemas/plan/op';
import type { QuoteRecord } from '@/schemas/plan/quote-record';
import { MAX_DISPLAY_QUOTES, PendingReading, type FieldVerdict } from '@/schemas/plan/state-token';
import type { StepContext, StepOutcome, StepSpec } from '@/server/http/post-step';
import { formReadBy } from '@/server/pipeline/reading-outcome';
import { readQuote } from '@/server/pipeline/read-quote';
import type { ReaderDeps } from '@/server/pipeline/run-reader';

import { quoteFieldsOf, type QuoteConfirmPart } from './quote-fields';
import { fieldsFrom, nextSlot, recordOrIssues, valuesFrom, type QuoteValues } from './quote-record';

// The three quote steps: read a pasted message (G2), enter a quote by form, and confirm a read
// quote from its check page. Each ends in the same place: one quoteAdded op and the quotes
// page, or the check page with the questions still open. Nothing pasted is ever stored.

// Blank text is a 400: there is nothing to read, and the textarea's `required` stops it anyway.
export const ReadQuoteForm = z.strictObject({ token: TokenField, quote: z.string().trim().min(1) });

type Ops = readonly Op[];

interface Opened {
  readonly ops: Ops;
  readonly data: DataDocuments;
  readonly today: IsoDate;
}

// A quote belongs to a plan, so a link still waiting on its first brief cannot take one.
function openForQuote(context: StepContext, token: string): Opened | StepOutcome {
  const opened = context.open(token);
  if (!opened.ok) return { kind: 'problem', problem: 'damaged-link' };
  const { state, view, data, today } = opened.plan;
  if (view === null || state.ops.length === 0) return { kind: 'problem', problem: 'cannot-apply' };
  return { ops: state.ops, data, today };
}

function isOutcome(value: Opened | StepOutcome): value is StepOutcome {
  return 'kind' in value;
}

/**
 * The quote as the plan's next op, then the quotes page where it is compared. The plan is
 * folded once here, so a seventh quote or one the engines refuse is a 422 with the plan
 * unchanged, instead of a sealed link that would only open as "damaged".
 */
function appendQuote(
  opened: Opened,
  values: QuoteValues,
  read: { readonly readBy: ReadBy; readonly fields: readonly FieldVerdict[] },
  lang: Lang,
): StepOutcome {
  const { readBy } = read;
  const slot = nextSlot(quoteSlotsOf(opened.ops));
  if (slot === null) return { kind: 'problem', problem: 'cannot-apply' };
  const checked = recordOrIssues(values, slot);
  if (!checked.ok) {
    // The read words stay beside their values; a value set aside now replaces its old verdict.
    const kept = read.fields.filter(
      (field) => !checked.verdicts.some((verdict) => verdict.field === field.field),
    );
    const fields = [...kept, ...checked.verdicts].slice(0, MAX_DISPLAY_QUOTES);
    return checkAgain(opened.ops, checked.values, fields, readBy, lang);
  }
  const op: Op = { kind: 'quoteAdded', quote: checked.record, readBy };
  if (!previewOp(opened.ops, op, opened.data, opened.today).ok) {
    return { kind: 'problem', problem: 'cannot-apply' };
  }
  return {
    kind: 'next',
    state: { schema: 1, ops: [...opened.ops, op] },
    to: (token) => ({ to: 'quotes', lang, token }),
  };
}

function quoteSlotsOf(ops: Ops): QuoteRecord[] {
  return ops.flatMap((op) => (op.kind === 'quoteAdded' ? [op.quote] : []));
}

/** Back to the check page with the plan's ops kept and the quote still pending. */
function checkAgain(
  ops: Ops,
  values: QuoteValues,
  verdicts: readonly FieldVerdict[],
  readBy: ReadBy,
  lang: Lang,
): StepOutcome {
  const pending = PendingReading.safeParse({ kind: 'quote', values, fields: verdicts, readBy });
  if (!pending.success) return { kind: 'problem', problem: 'cannot-apply' };
  return {
    kind: 'next',
    state: { schema: 1, ops: [...ops], pending: pending.data },
    to: (token) => ({ to: 'check', lang, token }),
  };
}

/**
 * G2: one model call, then the check page with the reading sealed beside the plan's ops, or
 * the quote form twin with the reason. A full plan is refused before the model is asked, so a
 * seventh quote never spends quota.
 */
export function readQuoteStep(deps: ReaderDeps): StepSpec<typeof ReadQuoteForm> {
  return {
    route: '/[lang]/read/[kind]',
    rateClass: 'model',
    schema: ReadQuoteForm,
    work: async (form, context) => {
      const opened = openForQuote(context, form.token);
      if (isOutcome(opened)) return opened;
      if (nextSlot(quoteSlotsOf(opened.ops)) === null) {
        return { kind: 'problem', problem: 'cannot-apply' };
      }
      const { lang } = context;
      const outcome = await readQuote(deps, { text: form.quote });
      if (outcome.kind === 'form') {
        return {
          kind: 'redirect',
          to: {
            to: 'quotes',
            lang,
            token: form.token,
            anchor: 'quote-form',
            unavailable: outcome.why,
          },
        };
      }
      return {
        kind: 'next',
        state: { schema: 1, ops: [...opened.ops], pending: outcome.pending },
        to: (token) => ({ to: 'check', lang, token }),
      };
    },
  };
}

/** The quote form twin: no model call; the same op as a confirmed reading, marked by form. */
export function enterQuoteStep(): StepSpec<typeof QuoteForm> {
  return {
    route: '/[lang]/enter/[kind]',
    rateClass: 'step',
    schema: QuoteForm,
    work: (form, context) => {
      const opened = openForQuote(context, form.token);
      if (isOutcome(opened)) return opened;
      return appendQuote(
        opened,
        valuesFrom(form),
        { readBy: formReadBy(), fields: [] },
        context.lang,
      );
    },
  };
}

/** Confirm on a quote's check page: the edited values become the plan's next op. */
export function confirmQuote(
  form: QuoteConfirmPart & { readonly token: string },
  pending: Extract<PendingReading, { kind: 'quote' }>,
  context: StepContext,
): StepOutcome {
  const opened = openForQuote(context, form.token);
  if (isOutcome(opened)) return opened;
  const fields = quoteFieldsOf(form, fieldsFrom(pending.values));
  return appendQuote(opened, valuesFrom(fields, pending.values.extras), pending, context.lang);
}
