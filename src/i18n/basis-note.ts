import type { Lang } from './lang';

/** A data row's "why this number" note: the English basis and, when written, its Hindi. */
export interface BasisSource {
  readonly basis: string;
  readonly basisHi?: string | null | undefined;
}

export interface BasisNote {
  readonly text: string;
  readonly lang: Lang;
}

/**
 * The note in the page's language, with the language it is actually written in. A Hindi page
 * falls back to the English note where no Hindi one exists, so the caller must put `lang` on
 * the element for a screen reader to switch voice.
 */
export function basisNote(row: BasisSource, lang: Lang): BasisNote {
  if (lang === 'hi' && row.basisHi !== undefined && row.basisHi !== null) {
    return { text: row.basisHi, lang: 'hi' };
  }
  return { text: row.basis, lang: 'en' };
}
