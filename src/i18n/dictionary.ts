// Plain objects, no framework: a page picks its dictionary once from the [lang] path segment
// and reads keys off it, so a misspelt key is a type error rather than a blank on screen.

import * as change from './areas/change';
import * as check from './areas/check';
import * as common from './areas/common';
import * as form from './areas/form';
import * as levers from './areas/levers';
import * as messages from './areas/messages';
import * as plan from './areas/plan';
import * as problems from './areas/problems';
import * as quotes from './areas/quotes';
import * as revision from './areas/revision';
import * as start from './areas/start';
import * as tasks from './areas/tasks';
import type { Lang } from './lang';

export interface Dictionary {
  readonly common: common.CommonDictionary;
  readonly start: start.StartDictionary;
  readonly form: form.FormDictionary;
  readonly check: check.CheckDictionary;
  readonly plan: plan.PlanDictionary;
  readonly tasks: tasks.TasksDictionary;
  readonly quotes: quotes.QuotesDictionary;
  readonly change: change.ChangeDictionary;
  readonly revision: revision.RevisionDictionary;
  readonly levers: levers.LeversDictionary;
  readonly messages: messages.MessagesDictionary;
  readonly problems: problems.ProblemsDictionary;
}

export type Area = keyof Dictionary;

function dictionaryOf(lang: Lang): Dictionary {
  return {
    common: common[lang],
    start: start[lang],
    form: form[lang],
    check: check[lang],
    plan: plan[lang],
    tasks: tasks[lang],
    quotes: quotes[lang],
    change: change[lang],
    revision: revision[lang],
    levers: levers[lang],
    messages: messages[lang],
    problems: problems[lang],
  };
}

const DICTIONARIES: Readonly<Record<Lang, Dictionary>> = {
  en: dictionaryOf('en'),
  hi: dictionaryOf('hi'),
};

export function dictionaryFor(lang: Lang): Dictionary {
  return DICTIONARIES[lang];
}
