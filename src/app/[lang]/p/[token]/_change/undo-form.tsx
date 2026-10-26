import type { ReactElement } from 'react';

import { PostForm, SubmitButton } from '@/components/form/post-form';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

/**
 * "Undo last step" (FR-29): a plain form posting the token, so it works with JavaScript off.
 * The label says "last step" because the last op may be any kind, not only a change.
 */
export function UndoForm({
  lang,
  token,
  id,
}: {
  readonly lang: Lang;
  readonly token: string;
  /** Unique on the page, for the hint the button is described by. */
  readonly id: string;
}): ReactElement {
  const words = dictionaryFor(lang).revision;
  const hint = `${id}-hint`;
  return (
    <PostForm lang={lang} route="undo" token={token} id={id}>
      <SubmitButton variant="secondary" describedBy={hint}>
        {words.undo}
      </SubmitButton>
      <p id={hint} className="mt-2 text-sm text-muted">
        {words.undoHint}
      </p>
    </PostForm>
  );
}
