import type { Metadata } from 'next';

import { dictionaryFor } from './dictionary';
import { isLang, type Lang } from './lang';
import { problemText, type ProblemKind } from './problem-text';

type PageName = keyof ReturnType<typeof dictionaryFor>['common']['pageTitles'];

/**
 * The tab title for a page that only needs its name (WCAG 2.4.2), from the [lang] segment
 * alone: it never opens the plan token, so nothing the user typed can reach a title. An
 * unknown language gets no title here; the page itself answers 404.
 */
export async function pageTitle(
  params: Promise<{ lang: string }>,
  page: PageName,
): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: dictionaryFor(lang).common.pageTitles[page] };
}

/** The title of a problem page: the same short heading the page shows. */
export function problemTitle(lang: Lang, problem: ProblemKind): Metadata {
  return { title: problemText(dictionaryFor(lang).problems, problem).title };
}
