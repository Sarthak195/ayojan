import 'server-only';

import type { MessageFacts } from '@/core/messages/fact-types';
import { buildMessageFacts } from '@/core/messages/message-facts';
import {
  enquiryTemplates,
  familyUpdateTemplate,
  vendorTemplates,
  type EnquiryTemplate,
  type FamilyUpdateTemplate,
  type VendorTemplate,
} from '@/core/messages/templates';
import { enquiryInput } from '@/core/plan/plan-enquiries';
import type { PlanView } from '@/core/plan/plan-view';
import type { Lang } from '@/i18n/lang';
import type { DataDocuments } from '@/schemas/data/data-files';
import type { ReadingCache } from '@/server/genai/reading-cache';
import { readingCache } from '@/server/genai/reading-cache';
import { cachedFamilyUpdate, type FamilyUpdateResult } from '@/server/pipeline/draft-family-update';

export interface MessagesModel {
  readonly facts: MessageFacts;
  readonly template: FamilyUpdateTemplate;
  readonly vendors: readonly VendorTemplate[];
  /** First messages for the vendor categories with no quote and no booking yet. */
  readonly enquiries: readonly EnquiryTemplate[];
  /** The checked draft or a cached rejection for these facts; null when never asked here. */
  readonly drafted: FamilyUpdateResult | null;
}

/**
 * Everything the messages page shows, from the plan alone. The GET never calls the model: the
 * family update is the template unless the reading cache holds a draft for these exact facts
 * and this language (D08). A cache miss (another instance, eviction) shows the template and
 * the button again.
 */
export function messagesModel(
  view: PlanView,
  data: DataDocuments,
  lang: Lang,
  cache: ReadingCache = readingCache(),
  nowMs: number = Date.now(),
): MessagesModel {
  const facts = buildMessageFacts(view.messageFacts);
  return {
    facts,
    template: familyUpdateTemplate(facts, lang),
    vendors: vendorTemplates(facts, data.vendorQuestions.questions, lang),
    enquiries: enquiryTemplates(enquiryInput(view.current, data), lang),
    drafted: cachedFamilyUpdate({ facts, language: lang }, cache, nowMs),
  };
}
