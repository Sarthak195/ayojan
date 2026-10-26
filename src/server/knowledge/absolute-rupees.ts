import 'server-only';

import type { DataProblem } from './data-problem';

// Planning data holds proportions, shares and day counts only: every rupee the app shows is
// the user's own budget, a share of it, or a pasted quote. A rupee word or a number of four or
// more digits in a data file would be a market price sneaking in, so boot refuses it.
const RUPEE_WORDS =
  /(?:\b(?:rs\.?|inr|rupees?|lakhs?|lacs?|crores?|hazaa?r)\b|₹|रुपय|रुपए|रुपये|लाख|करोड़|हज़ार|हजार)/i;
const LARGE_NUMBER = /\d[\d,]{3,}/;
// A sign-off date in `reviewed` ("SK 2026-10-27") has a four-digit year, not a price.
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g;

export function absoluteRupeeProblems(fileName: string, text: string): DataProblem[] {
  return text.split('\n').flatMap((line, index) => {
    // Comments are scanned too: a price in a comment invites someone to copy it into a row.
    const content = line.replace(ISO_DATE, '');
    if (!RUPEE_WORDS.test(content) && !LARGE_NUMBER.test(content)) return [];
    return [
      {
        fileName,
        row: `line ${String(index + 1)}`,
        message: 'Looks like an absolute rupee amount; data files hold proportions and days only.',
      },
    ];
  });
}
