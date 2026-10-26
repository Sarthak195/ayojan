import 'server-only';

import { z } from 'zod';

import { defaultGateway } from '@/server/genai/gateway';
import { defaultStepDeps, type StepDeps, type StepSpec } from '@/server/http/post-step';
import type { ExampleBook } from '@/server/pipeline/example-readings';
import type { LlmGateway } from '@/server/pipeline/llm-gateway';
import { readBrief } from '@/server/pipeline/read-brief';

// Blank text is a 400: there is nothing to read, and a browser's `required` stops it anyway.
// The 2,000 code point cap is readForm's 422, checked after this structure passes.
export const ReadBriefForm = z.strictObject({ brief: z.string().trim().min(1) });

export interface ReadDeps extends StepDeps {
  readonly gateway: LlmGateway;
  /** The committed sample recordings; production uses the process-wide book. */
  readonly examples?: ExampleBook;
}

export function defaultReadDeps(): ReadDeps {
  return { ...defaultStepDeps(), gateway: defaultGateway() };
}

/**
 * G1: one model call, then either the check page with the reading sealed into the link (so a
 * reload never calls the model again) or the form twin with the reason. Nothing is appended
 * to a plan by a read (NFR-ALN-7); only the confirm step adds an op.
 */
export function readBriefStep(deps: ReadDeps): StepSpec<typeof ReadBriefForm> {
  return {
    route: '/[lang]/read/[kind]',
    rateClass: 'model',
    schema: ReadBriefForm,
    work: async (form, { lang, sources }) => {
      const outcome = await readBrief(deps, { text: form.brief, today: sources.today() });
      if (outcome.kind === 'form') {
        return { kind: 'redirect', to: { to: 'form', lang, unavailable: outcome.why } };
      }
      return {
        kind: 'next',
        state: { schema: 1, ops: [], pending: outcome.pending },
        to: (token) => ({ to: 'check', lang, token }),
      };
    },
  };
}
