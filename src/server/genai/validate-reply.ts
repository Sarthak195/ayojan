import 'server-only';

import type { z } from 'zod';

import { GatewayBugError } from './classify';

/** Validate twice: the reply must be JSON, then it must satisfy the caller's schema. */
export function validateReply<T>(schema: z.ZodType<T>, outputText: string): T {
  let json: unknown;
  try {
    json = JSON.parse(outputText);
  } catch {
    throw new GatewayBugError('schema-violation', 'the reply is not JSON');
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const paths = parsed.error.issues.map((issue) => issue.path.join('.') || '(root)');
    throw new GatewayBugError(
      'schema-violation',
      `${String(paths.length)} issue(s) at ${paths.join(', ')}`,
    );
  }
  return parsed.data;
}
