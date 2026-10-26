import { seeOther } from '@/server/http/see-other';

// A page's redirect() answers 307, which keeps the method; a 303 says "now GET this", the same
// answer every step of the app gives, and it carries no cache entry for the bare domain.
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return seeOther({ to: 'start', lang: 'en' });
}
