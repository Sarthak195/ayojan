import type { ReactElement } from 'react';

import { PostForm, ReadingHint, SubmitButton } from '@/components/form/post-form';
import { TextArea } from '@/components/form/fields';
import { loadLangPage } from '@/server/view/plan-page';

import { exampleBriefText } from './_brief/example-text';

export default async function StartPage({
  params,
}: {
  readonly params: Promise<{ lang: string }>;
}): Promise<ReactElement> {
  const { lang, dict } = await loadLangPage(params);
  const words = dict.start;
  const example = exampleBriefText();
  return (
    <div>
      <h1 className="text-2xl font-bold">{words.title}</h1>
      <p className="mt-4">{words.intro}</p>

      <PostForm lang={lang} route="read/brief" id="brief-form">
        <TextArea name="brief" label={words.briefLabel} hint={words.briefHint} required />
        <SubmitButton describedBy="read-hint">{words.readButton}</SubmitButton>
        <ReadingHint lang={lang} id="read-hint" />
      </PostForm>
      <p className="mt-2">
        <a href={`/${lang}/form`} className="inline-flex min-h-11 items-center font-semibold">
          {words.formFallback}
        </a>
      </p>

      {example === null ? null : (
        <section aria-labelledby="example-heading" className="mt-8">
          <h2 id="example-heading" className="text-xl font-semibold">
            {words.exampleHeading}
          </h2>
          <p id="example-note" className="mt-2">
            {words.exampleNote}
          </p>
          {/* The sample travels in the POST body, like typed text: never in a URL. */}
          <PostForm lang={lang} route="read/brief">
            <input type="hidden" name="brief" value={example} />
            <div className="mt-2">
              <SubmitButton variant="secondary" describedBy="example-note example-hint">
                {words.exampleButton}
              </SubmitButton>
            </div>
            <ReadingHint lang={lang} id="example-hint" />
          </PostForm>
        </section>
      )}

      <section aria-labelledby="how-heading" className="mt-8">
        <h2 id="how-heading" className="text-xl font-semibold">
          {words.howHeading}
        </h2>
        <ol className="mt-2 list-decimal space-y-1 pl-6">
          <li>{words.howRead}</li>
          <li>{words.howCheck}</li>
          <li>{words.howCompute}</li>
        </ol>
      </section>
    </div>
  );
}
