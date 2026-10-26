import 'server-only';

import { resolveFormBrief } from '@/core/brief/confirm-brief';
import { isLang } from '@/i18n/lang';
import { BriefForm } from '@/schemas/forms/brief-form';
import { defaultStepDeps, runStep, type StepDeps } from '@/server/http/post-step';
import { problemResponse } from '@/server/http/problem-page';
import { formReadBy } from '@/server/pipeline/reading-outcome';

import { checkAgain, planFromBrief } from '../../_brief/brief-steps';

export const dynamic = 'force-dynamic';

/**
 * POST /[lang]/enter/[kind], the form twin: no model call. Valid values go straight to the
 * plan; a value that needs a question goes to the check page marked "Entered by form". The
 * same resolver as the reader path decides, so the same facts give the same plan (FR-5).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ lang: string; kind: string }> },
  deps: StepDeps = defaultStepDeps(),
): Promise<Response> {
  const { lang, kind } = await context.params;
  if (kind !== 'brief') {
    return problemResponse({ lang: isLang(lang) ? lang : 'en', problem: 'not-found' });
  }
  return runStep(
    request,
    Promise.resolve({ lang }),
    {
      route: '/[lang]/enter/[kind]',
      rateClass: 'step',
      schema: BriefForm,
      work: (form, context) => {
        const data = context.sources.data();
        const today = context.sources.today();
        const resolution = resolveFormBrief(form, { today, weights: data.budgetWeights });
        return resolution.ok
          ? planFromBrief(resolution.brief, formReadBy(), context.lang, data, today)
          : checkAgain(resolution.draft, [], formReadBy(), context.lang);
      },
    },
    deps,
  );
}
