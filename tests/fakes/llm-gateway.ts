import { GatewayBugError } from '@/server/genai/classify';
import type { ExtractionRequest, GatewayResult, LlmGateway } from '@/server/pipeline/llm-gateway';

/** A recorded reading for a prompt id, or the failure the test wants that prompt to meet. */
export type FakeReply = { readonly reading: unknown } | 'quota' | 'timeout' | 'schema-violation';

export interface FakeLlmGateway extends LlmGateway {
  readonly calls: { readonly promptId: string; readonly text: string }[];
}

/** Routes on prompt identity, as the recorder does, and keeps every call it receives. */
export function fakeLlmGateway(replies: ReadonlyMap<string, FakeReply>): FakeLlmGateway {
  const calls: { promptId: string; text: string }[] = [];
  return {
    calls,
    extract<T>(request: ExtractionRequest<T>): Promise<GatewayResult<T>> {
      calls.push({ promptId: request.prompt.id, text: request.text });
      const reply = replies.get(request.prompt.id);
      if (reply === undefined) throw new Error(`No fake reply for prompt "${request.prompt.id}"`);
      if (reply === 'schema-violation') throw new GatewayBugError('schema-violation', 'fake');
      if (reply === 'quota' || reply === 'timeout') {
        return Promise.resolve({ kind: 'unavailable', reason: reply });
      }
      const value = request.schema.parse(reply.reading);
      return Promise.resolve({ kind: 'reading', source: 'ai', value, answeredBy: 'fake-model' });
    },
  };
}
