import type { ReactElement } from 'react';

import { Icon } from '@/components/status/icon';
import type { VendorContact } from '@/core/plan/plan-vendors';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

// Only the questions a change raised; the vendor's other questions live on the quotes page.
function reconfirmQuestions(vendor: VendorContact): VendorContact['questions'] {
  return vendor.questions.filter(
    (question) =>
      question.raisedBy.when === 'reconfirmation' || question.raisedBy.when === 'capExceeded',
  );
}

/**
 * The vendors whose agreed guests or date the plan has moved away from (FR-27), each marked
 * "Needs re-confirmation" with an icon and the word, and the questions to send them.
 */
export function ReconfirmList({
  vendors,
  lang,
}: {
  readonly vendors: readonly VendorContact[];
  readonly lang: Lang;
}): ReactElement {
  const words = dictionaryFor(lang).revision;
  const asked = vendors.filter((vendor) => vendor.status === 'needs-reconfirmation');
  return (
    <section id="reconfirm" aria-labelledby="reconfirm-heading" className="mt-8">
      <h2 id="reconfirm-heading" className="text-xl font-semibold">
        {words.reconfirmHeading}
      </h2>
      {asked.length === 0 ? (
        <p className="mt-2">{words.reconfirmNone}</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">{words.reconfirmIntro}</p>
          <ul className="mt-2 space-y-4">
            {asked.map((vendor) => (
              <li key={vendor.label.en} className="rounded border border-line p-3">
                <p className="font-semibold">{vendor.label[lang]}</p>
                <p className="mt-1 inline-flex items-center gap-1 font-medium text-risk">
                  <Icon name="triangle" />
                  <span>{words.needsReconfirmation}</span>
                </p>
                <ul className="mt-1 list-disc pl-6 text-sm">
                  {vendor.reconfirm.map((reason) => (
                    <li key={reason}>{words.reconfirmReason[reason]}</li>
                  ))}
                </ul>
                <ol className="mt-2 list-decimal space-y-1 pl-6">
                  {reconfirmQuestions(vendor).map((question) => (
                    <li key={question.id}>{question[lang]}</li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
