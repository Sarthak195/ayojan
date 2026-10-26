import type { ReactElement } from 'react';

import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';
import { problemText, type ProblemKind } from '@/i18n/problem-text';

export interface ProblemViewProps {
  readonly lang: Lang;
  readonly problem: ProblemKind;
  /** A link back; built from fixed routes (see locationOf), never from the request URL. */
  readonly back?: { readonly href: string; readonly label: string };
  readonly retryAfterSeconds?: number;
}

/**
 * A problem rendered inside the layout, for not-found.tsx files: the page's one h1, what
 * happened, and where to go next. Without a `back`, it offers a new plan on the start page.
 */
export function ProblemView({
  lang,
  problem,
  back,
  retryAfterSeconds,
}: ProblemViewProps): ReactElement {
  const words = dictionaryFor(lang).problems;
  const { title, body } = problemText(words, problem, retryAfterSeconds);
  const link = back ?? { href: `/${lang}`, label: words.startNewPlan };
  return (
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-4">{body}</p>
      <p className="mt-6">
        <a href={link.href} className="inline-flex min-h-11 items-center font-semibold">
          {link.label}
        </a>
      </p>
    </div>
  );
}
