import { z } from 'zod';

// Fields every data row carries. A basis is the author's stated assumption and never a cited
// source (D37): nobody fetched and verified a survey, so naming one would be the "AI inventing
// prices" defect one level up. `reviewed` records a review for people; no plan or page uses it.

export const BASIS_PREFIX = 'Planning assumption chosen by the author: ';
// The same phrase in Hindi, fixed so every Hindi note opens the way its English note does.
export const BASIS_PREFIX_HI = 'योजना के लिए लेखक का चुना हुआ अनुमान: ';

const DEVANAGARI = /[ऀ-ॿ]/;
const CITATION = /https?:|www\.|\bsurvey|\breport|\bstudy|\bstudies|according to|\bsource\b/i;

export const English = z.string().trim().min(1, 'English text is missing.');

export const Hindi = z
  .string()
  .trim()
  .min(1, 'Hindi text is missing.')
  .refine((text) => DEVANAGARI.test(text), 'Hindi text must be written in Devanagari.');

export const Bilingual = z.strictObject({ en: English, hi: Hindi });

export const Basis = z
  .string()
  .refine(
    (text) => text.startsWith(BASIS_PREFIX) && text.trim().length > BASIS_PREFIX.length,
    `The basis must read "${BASIS_PREFIX}" followed by one line of reasoning.`,
  )
  .refine((text) => !text.includes('\n'), 'The basis must be one line.')
  .refine((text) => !CITATION.test(text), 'The basis must not cite a source, survey or link.');

// Optional, because a row without one falls back to the English note on a Hindi page; once
// written it must say something, in Devanagari, under the same rules as the English note.
export const BasisHi = Hindi.refine(
  (text) => text.startsWith(BASIS_PREFIX_HI) && text.length > BASIS_PREFIX_HI.length,
  `The Hindi basis must read "${BASIS_PREFIX_HI}" followed by one line of reasoning.`,
)
  .refine((text) => !text.includes('\n'), 'The Hindi basis must be one line.')
  .refine(
    (text) => !CITATION.test(text),
    'The Hindi basis must not cite a source, survey or link.',
  );

export const Reviewed = z.string();

export const RowId = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, 'Ids are lower-case words joined by hyphens.');

export const planningRow = {
  en: English,
  hi: Hindi,
  basis: Basis,
  basisHi: BasisHi.optional(),
  reviewed: Reviewed,
};

export const Percent = z.number().int().min(0).max(100);

export const Days = z.number().int().min(0).max(365);

export const DurationDays = z.number().int().min(1).max(365);
