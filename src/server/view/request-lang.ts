import 'server-only';

import { headers } from 'next/headers';

import type { Lang } from '@/i18n/lang';
import { LANG_HEADER, langOfHeader } from '@/i18n/path';

/**
 * The page language for files that receive no params (not-found.tsx): the proxy sets it on
 * every request from the first path segment and overwrites anything the client sent.
 */
export async function requestLang(): Promise<Lang> {
  return langOfHeader((await headers()).get(LANG_HEADER));
}
