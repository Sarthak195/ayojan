import 'server-only';

import { GoogleGenAI } from '@google/genai';

import type { InteractionsClient } from './interactions';

const HOLDER = Symbol.for('ayojan.genaiClients');
type ClientHolder = typeof globalThis & { [HOLDER]?: Map<string, InteractionsClient> };

function wrap(sdk: GoogleGenAI): InteractionsClient {
  return {
    async create(request, options) {
      const interaction = await sdk.interactions.create(request, options);
      return {
        output_text: interaction.output_text,
        model: interaction.model,
        usage: { total_tokens: interaction.usage?.total_tokens },
      };
    },
  };
}

/**
 * The only file that imports the SDK. A client is built the first time its key is used, never
 * at module load (so `next build` needs no key), and kept on globalThis because Next bundles
 * each route separately and a module-level map would build a second client per route.
 */
export function interactionsClientFor(apiKey: string): InteractionsClient {
  const holder: ClientHolder = globalThis;
  const clients = holder[HOLDER] ?? new Map<string, InteractionsClient>();
  holder[HOLDER] = clients;
  const held = clients.get(apiKey);
  if (held !== undefined) return held;
  const created = wrap(new GoogleGenAI({ apiKey }));
  clients.set(apiKey, created);
  return created;
}
