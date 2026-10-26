import { healthReport } from '@/server/observability/health';

// Reads the environment on each call, so it must never be prerendered at build time.
export const dynamic = 'force-dynamic';

// Makes no model call (it would spend quota on every probe) and reports counts only, never
// key material. 503 only when the seal key or the planning data cannot load: without a
// Gemini key the form twin still works, so that is `ai: "unavailable"` with a 200 (FR-45).
export function GET(): Response {
  const { httpStatus, report } = healthReport();
  return Response.json(report, {
    status: httpStatus,
    headers: { 'Cache-Control': 'no-store' },
  });
}
