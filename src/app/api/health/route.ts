import { loadKeyPool } from '@/server/config/key-pool';

// Reads the environment on each call, so it must never be prerendered at build time.
export const dynamic = 'force-dynamic';

interface HealthReport {
  readonly status: 'ok' | 'unavailable';
  readonly keys: number;
  readonly problems: readonly string[];
}

// Makes no model call (it would spend quota on every probe) and reports only a count,
// never key material.
export function GET(): Response {
  const { count } = loadKeyPool();
  const report: HealthReport =
    count > 0
      ? { status: 'ok', keys: count, problems: [] }
      : {
          status: 'unavailable',
          keys: 0,
          problems: ['No Gemini API key is configured: set GEMINI_API_KEY.'],
        };

  return Response.json(report, {
    status: count > 0 ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
