// Shared pieces for the HTTP boundary tests: the route handlers are called directly with
// Request objects, the model is the fake gateway, and a 303's Location is followed by hand.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ReadDeps } from '@/app/[lang]/read/[kind]/read-step';
import type { StateToken } from '@/schemas/plan/state-token';
import { createExampleBook, type ExampleBook } from '@/server/pipeline/example-readings';
import { decodeState } from '@/server/state/token-codec';

import { fakeLlmGateway, type FakeLlmGateway, type FakeReply } from '../fakes/llm-gateway';
import { deps, SEAL_KEY } from '../unit/server/http/step-support';

export { deps, seal, sources, SEAL_KEY, TODAY, DATA } from '../unit/server/http/step-support';

function repoText(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

/** The sample brief exactly as committed, and the reply recorded for it. */
export const HINGLISH_TEXT = repoText('fixtures/brief-hinglish.txt');
const recording: unknown = JSON.parse(repoText('golden/llm/brief-hinglish.brief.json'));
export const HINGLISH_READING: unknown =
  typeof recording === 'object' && recording !== null && 'reply' in recording
    ? recording.reply
    : null;

export const NO_EXAMPLES: ExampleBook = createExampleBook([]);

/** Step deps for the read route, with a fake gateway that answers the brief prompt. */
export function readDeps(
  reply: FakeReply,
  examples: ExampleBook = NO_EXAMPLES,
): { readonly gateway: FakeLlmGateway; readonly deps: ReadDeps } {
  const gateway = fakeLlmGateway(new Map([['brief', reply]]));
  return { gateway, deps: { ...deps(), gateway, examples } };
}

export type Fields = Readonly<Record<string, string | readonly string[]>>;

/** A urlencoded POST; a list value repeats the field, as checkboxes do. */
export function post(
  path: string,
  fields: Fields,
  contentType = 'application/x-www-form-urlencoded',
): Request {
  const body = new URLSearchParams();
  for (const [name, value] of Object.entries(fields)) {
    for (const each of typeof value === 'string' ? [value] : value) body.append(name, each);
  }
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': contentType, 'x-forwarded-for': '203.0.113.9' },
    body: body.toString(),
  });
}

export function context<P extends Record<string, string>>(params: P): { params: Promise<P> } {
  return { params: Promise.resolve(params) };
}

export function location(response: Response): string {
  return response.headers.get('location') ?? '';
}

const PLAN_LOCATION = /^\/(?:en|hi)\/p\/([A-Za-z0-9_-]+)(\/check)?$/;

/** The token of a 303 to a plan or check page; throws on any other Location. */
export function tokenOf(response: Response): string {
  const match = PLAN_LOCATION.exec(location(response));
  if (match?.[1] === undefined) throw new Error(`not a plan location: ${location(response)}`);
  return match[1];
}

export function stateOf(token: string): StateToken {
  const decoded = decodeState(token, SEAL_KEY);
  if (!decoded.ok) throw new Error(`token did not decode: ${decoded.reason}`);
  return decoded.state;
}

/** The check page's answers for the sample brief, as a person would leave them. */
export const HINGLISH_ANSWERS: Fields = {
  intent: 'confirm',
  occasion: 'wedding',
  budget: '800000',
  guests: '200',
  eventDate: '2027-02-26',
  venueCapacity: '',
  functionHaldi: 'yes',
  functionMehndi: 'yes',
  functionSangeet: 'unsure',
  functionWedding: 'unsure',
  functionReception: 'unsure',
  priorityVenue: 'unclear',
  priorityCatering: 'more',
  priorityDecor: 'save',
  priorityPhoto: 'unclear',
  priorityMusic: 'unclear',
  priorityInvites: 'unclear',
  priorityContingency: 'unclear',
  mustHave: ['dhol'],
  need: ['wheelchair'],
  diet: ['jain'],
  venueLimit: ['indoorOnly'],
};

/** The same facts typed into the form twin. */
export const HINGLISH_FORM: Fields = {
  occasion: 'wedding',
  budget: '8 lakh',
  guests: '200',
  eventDate: '2027-02-26',
  venueCapacity: '',
  functionHaldi: 'yes',
  functionMehndi: 'yes',
  functionSangeet: 'unsure',
  functionWedding: 'unsure',
  functionReception: 'unsure',
  priorityVenue: 'standard',
  priorityCatering: 'more',
  priorityDecor: 'save',
  priorityPhoto: 'standard',
  priorityMusic: 'standard',
  priorityInvites: 'standard',
  priorityContingency: 'standard',
  mustHave: ['dhol'],
  need: ['wheelchair'],
  diet: ['jain'],
  venueLimit: ['indoorOnly'],
};

/** next/navigation's notFound() and redirect() throw an error whose digest names them. */
export async function digestOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'digest' in error) {
      return String(error.digest);
    }
    throw error;
  }
  return 'resolved';
}
