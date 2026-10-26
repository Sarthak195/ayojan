import type { ReactElement, ReactNode } from 'react';

import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

/** The POST routes of arch 6.2. A form can only post to one of these fixed paths. */
export type StepRoute =
  | 'read/brief'
  | 'read/quote'
  | 'read/change'
  | 'enter/brief'
  | 'enter/quote'
  | 'enter/change'
  | 'confirm'
  | 'task'
  | 'levers'
  | 'undo'
  | 'messages';

export function stepAction(lang: Lang, route: StepRoute): string {
  return `/${lang}/${route}`;
}

/**
 * A plain HTML form posting to a route handler that answers 303, so the whole loop works with
 * JavaScript off. The sealed token, when there is one, rides in a hidden field, never in a
 * query string.
 */
export function PostForm({
  lang,
  route,
  token,
  id,
  children,
}: {
  readonly lang: Lang;
  readonly route: StepRoute;
  readonly token?: string;
  readonly id?: string;
  readonly children?: ReactNode;
}): ReactElement {
  return (
    <form method="post" action={stepAction(lang, route)} id={id}>
      {token === undefined ? null : <input type="hidden" name="token" value={token} />}
      {children}
    </form>
  );
}

export interface SubmitButtonProps {
  readonly children: ReactNode;
  /** For a form with several actions, such as `intent=confirm` and `intent=cancel`. */
  readonly name?: string;
  readonly value?: string;
  /** Id of a hint such as the reading hint, read out with the button. */
  readonly describedBy?: string;
  readonly variant?: 'primary' | 'secondary';
}

const VARIANT: Readonly<Record<'primary' | 'secondary', string>> = {
  primary: 'bg-foreground text-background',
  secondary: 'border border-foreground bg-background text-foreground',
};

/** A real submit button with a 44 px target. */
export function SubmitButton({
  children,
  name,
  value,
  describedBy,
  variant = 'primary',
}: SubmitButtonProps): ReactElement {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      aria-describedby={describedBy}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded px-4 font-semibold ${VARIANT[variant]}`}
    >
      {children}
    </button>
  );
}

/**
 * D16: "Reading can take up to 40 seconds.", rendered on the server under each read button.
 * D41: the privacy sentence shares this <p>, so the button's aria-describedby covers both. These
 * boxes invite vendor quotes and family details, and the free tier's terms let Google use what is
 * sent.
 */
export function ReadingHint({
  lang,
  id,
}: {
  readonly lang: Lang;
  readonly id: string;
}): ReactElement {
  const { common } = dictionaryFor(lang);
  return (
    <p id={id} className="mt-2 text-sm text-muted">
      {common.readingHint} {common.privacyHint}
    </p>
  );
}
