import type { ReactElement, ReactNode } from 'react';

import type { Banner } from '@/core/plan/plan-view';
import { dictionaryFor } from '@/i18n/dictionary';
import type { Lang } from '@/i18n/lang';

import { Amount } from '../money/amount';
import { Icon } from '../status/icon';

export type BannerTone = 'note' | 'warning';

/** Why the AI reader could not answer (D18 f); the same closed set the 303 carries. */
export type AiUnavailableReason = 'quota' | 'timeout' | 'nokey';

const TONE_CLASS: Readonly<Record<BannerTone, string>> = {
  note: 'border-note-line bg-note-bg',
  warning: 'border-warn-line bg-warn-bg',
};

/** A boxed message led by an icon and a word ("Note", "Warning"), so tone is never colour alone. */
export function BannerBox({
  tone,
  lang,
  children,
}: {
  readonly tone: BannerTone;
  readonly lang: Lang;
  readonly children: ReactNode;
}): ReactElement {
  const words = dictionaryFor(lang).common.banner;
  return (
    <div className={`my-4 flex gap-2 rounded border-l-4 p-3 ${TONE_CLASS[tone]}`}>
      <Icon name={tone === 'note' ? 'info' : 'triangle'} className="mt-0.5 shrink-0" />
      <p>
        <strong>{tone === 'note' ? words.noteWord : words.warningWord}:</strong> {children}
      </p>
    </div>
  );
}

/** Above the form when a read failed: names the reason, then promises the same computation. */
export function AiUnavailableBanner({
  lang,
  reason,
}: {
  readonly lang: Lang;
  readonly reason: AiUnavailableReason;
}): ReactElement {
  const words = dictionaryFor(lang).common.banner;
  return (
    <BannerBox tone="warning" lang={lang}>
      {words.aiUnavailable(words.aiReason[reason])}
    </BannerBox>
  );
}

function PlanBanner({
  banner,
  lang,
}: {
  readonly banner: Banner;
  readonly lang: Lang;
}): ReactElement {
  const words = dictionaryFor(lang).common.banner;
  switch (banner.kind) {
    case 'small-celebration-profile':
      return (
        <BannerBox tone="note" lang={lang}>
          {words.smallCelebration}
        </BannerBox>
      );
    case 'short-notice':
      return (
        <BannerBox tone="warning" lang={lang}>
          {words.shortNotice(banner.daysToEvent)}
        </BannerBox>
      );
    case 'over-budget':
      return (
        <BannerBox tone="warning" lang={lang}>
          {words.overBudget}{' '}
          <Amount money={{ inr: banner.gapInr, provenance: 'computed' }} lang={lang} />
        </BannerBox>
      );
  }
}

/** The plan view's banners (small-celebration profile, short notice, over budget), in order. */
export function PlanBanners({
  banners,
  lang,
}: {
  readonly banners: readonly Banner[];
  readonly lang: Lang;
}): ReactElement | null {
  if (banners.length === 0) return null;
  return (
    <div>
      {banners.map((banner) => (
        <PlanBanner key={banner.kind} banner={banner} lang={lang} />
      ))}
    </div>
  );
}
