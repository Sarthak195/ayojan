import 'server-only';

import { z } from 'zod';

import { buildMessageFacts } from '@/core/messages/message-facts';
import { TokenField } from '@/schemas/forms/form-field';
import { defaultGateway } from '@/server/genai/gateway';
import { defaultStepDeps, type StepDeps, type StepSpec } from '@/server/http/post-step';
import type { UnavailableReason } from '@/server/http/see-other';
import { draftFamilyUpdate, type FamilyUpdateResult } from '@/server/pipeline/draft-family-update';
import type { LlmGateway } from '@/server/pipeline/llm-gateway';

export const DraftForm = z.strictObject({ token: TokenField });

export interface MessageDeps extends StepDeps {
  readonly gateway: LlmGateway;
}

export function defaultMessageDeps(): MessageDeps {
  return { ...defaultStepDeps(), gateway: defaultGateway() };
}

// Our own bug reads like a timeout ("busy"), the same as on the read path: the family can do
// nothing about it, and the template carries the same numbers either way.
function unavailableOf(result: FamilyUpdateResult): UnavailableReason | null {
  if (result.kind !== 'template' || result.unavailable === null) return null;
  return result.unavailable === 'our-bug' ? 'timeout' : result.unavailable;
}

/**
 * "Write it with AI" (G4, D07, FR-35): one drafting call for the family update only. The
 * checked draft, or a rejection, lives in the reading cache under the facts hash, never in the
 * link (D08), so the step reseals nothing and 303s back to the messages page, which reads it.
 * A failed call adds the closed reason to the 303 so the page can name it.
 */
export function messageStep(deps: MessageDeps): StepSpec<typeof DraftForm> {
  return {
    route: '/[lang]/messages',
    rateClass: 'model',
    schema: DraftForm,
    work: async (form, context) => {
      const { lang } = context;
      const opened = context.open(form.token);
      if (!opened.ok) return { kind: 'problem', problem: 'damaged-link' };
      const { view } = opened.plan;
      if (view === null) return { kind: 'problem', problem: 'cannot-apply', status: 422 };
      const facts = buildMessageFacts(view.messageFacts);
      const result = await draftFamilyUpdate(deps.gateway, { facts, language: lang });
      const unavailable = unavailableOf(result);
      const token = form.token;
      return {
        kind: 'redirect',
        to:
          unavailable === null
            ? { to: 'messages', lang, token }
            : { to: 'messages', lang, token, unavailable },
      };
    },
  };
}
