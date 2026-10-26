import type { BriefField, BriefQuestion } from '@/core/brief/questions';
import { formatRupees } from '@/core/rupees/format';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import type { FieldVerdict } from '@/schemas/plan/state-token';
import { Occasion } from '@/schemas/readings/vocabulary';

import { boundWords, countWords, dateWords } from '../../../_brief/words';

/** The verdict a question belongs to: the reader records the event date as `date`. */
export function verdictFor(
  field: BriefField,
  fields: readonly FieldVerdict[],
): FieldVerdict | undefined {
  const name = field === 'eventDate' ? 'date' : field;
  return fields.find((verdict) => verdict.field === name);
}

// What the person gave, in the words the page uses for that field.
function givenWords(question: BriefQuestion, lang: Lang): string {
  const { given, field } = question;
  if (typeof given === 'number') {
    return field === 'budget' ? formatRupees(given) : countWords(given);
  }
  if (given === null) return '';
  if (field === 'eventDate') return dateWords(given, lang);
  const occasion = Occasion.safeParse(given);
  return field === 'occasion' && occasion.success
    ? dictionaryFor(lang).form.occasions[occasion.data]
    : given;
}

// Why the reader's words did not give one usable value ("We read 'Feb end mein', which is not
// one date"). A value that was found but fell outside a bound needs no such line: the bound
// itself is the reason.
function readingNote(
  question: BriefQuestion,
  verdict: FieldVerdict | undefined,
  lang: Lang,
): string | null {
  const quote = verdict?.displayQuote;
  if (verdict === undefined || quote === undefined || quote === null) return null;
  const words = dictionaryFor(lang).check;
  if (verdict.reason === 'quote-not-found') return words.notFound(quote);
  if (
    verdict.status === 'unclear' ||
    (verdict.status === 'unverified' && verdict.reason !== 'out-of-bounds')
  ) {
    return words.notOne[question.field](quote);
  }
  return null;
}

const SHOWS_GIVEN = new Set(['out-of-range', 'date-passed', 'date-invalid', 'no-profile']);

/**
 * A question's reason as one plain sentence or three: what was read, what was given, and what
 * to do. The input itself stays empty, because a question never carries a default (FR-3).
 */
export function questionText(
  question: BriefQuestion,
  verdict: FieldVerdict | undefined,
  lang: Lang,
): string {
  const words = dictionaryFor(lang).check;
  const parts: string[] = [];
  const note = readingNote(question, verdict, lang);
  if (note !== null) parts.push(note);
  const given = givenWords(question, lang);
  if (given !== '' && SHOWS_GIVEN.has(question.reason)) parts.push(words.gave(given));
  const reason = words.question[question.reason];
  parts.push(
    question.reason === 'out-of-range' && question.bounds !== null
      ? reason(
          boundWords(question.field, question.bounds.min),
          boundWords(question.field, question.bounds.max),
        )
      : reason(given, ''),
  );
  return parts.join(' ');
}
