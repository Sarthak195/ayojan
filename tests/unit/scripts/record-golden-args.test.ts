import { describe, expect, it } from 'vitest';

import { listFixtures, parseArgs, quoteTally, routeFixture } from '../../../scripts/record-golden';

const KNOWN = new Set(['brief-hinglish', 'quote-caterer-a']);

// The recorder spends shared quota, so the cases that matter most are the refusals: a typo or a
// stray word must stop the run before any call, never fall through to "record everything".
describe('record-golden arguments', () => {
  it('accepts no arguments, --dry-run and --only with a known fixture', () => {
    expect(parseArgs([], KNOWN)).toEqual({ ok: true, only: null, dryRun: false });
    expect(parseArgs(['--dry-run'], KNOWN)).toEqual({ ok: true, only: null, dryRun: true });
    expect(parseArgs(['--only', 'brief-hinglish', '--dry-run'], KNOWN)).toEqual({
      ok: true,
      only: 'brief-hinglish',
      dryRun: true,
    });
  });

  it.each([
    ['a misspelt flag', ['--onyl', 'brief-hinglish']],
    ['an unknown flag', ['--all']],
    ['a stray positional word', ['brief-hinglish']],
    ['the equals form, which is not supported', ['--only=brief-hinglish']],
    ['--only without a name', ['--only']],
    ['--only followed by a flag', ['--only', '--dry-run']],
    ['--only with an unknown fixture', ['--only', 'brief-hinglsh']],
    ['--only given twice', ['--only', 'brief-hinglish', '--only', 'quote-caterer-a']],
    ['--dry-run given twice', ['--dry-run', '--dry-run']],
  ])('refuses %s', (_label, argv) => {
    expect(parseArgs(argv, KNOWN).ok).toBe(false);
  });
});

describe('record-golden routing', () => {
  it.each([
    ['brief-hinglish.txt', 'brief'],
    ['quote-injection.txt', 'quote'],
    ['change-explainer-sentence.txt', 'change'],
    ['family-update-facts.json', 'familyUpdate'],
  ])('routes %s to the %s prompt', (file, promptId) => {
    expect(routeFixture(file)).toBe(promptId);
  });

  it.each(['notes.txt', 'brief-hinglish.json', 'family-update-facts.txt', 'brief-hinglish.md'])(
    'routes no prompt to %s',
    (file) => {
      expect(routeFixture(file)).toBeUndefined();
    },
  );

  it('routes every committed fixture, including the 15 attempt-1 texts and the facts', () => {
    const fixtures = listFixtures();
    expect(fixtures.size).toBeGreaterThanOrEqual(16);
    expect(fixtures.get('change-explainer-sentence')).toBe('change');
    expect(fixtures.get('family-update-facts')).toBe('familyUpdate');
  });
});

describe('record-golden quote tally', () => {
  it('counts the non-empty quotes found in the text, at any depth', () => {
    const reading = {
      budget: { quote: 'budget 8 lakh' },
      guests: { quote: '' },
      priorities: [{ quote: 'Khana sabse important' }, { quote: 'not in the text' }],
    };
    const text = 'Bhai ki shaadi, budget 8 lakh. Khana sabse important.';
    expect(quoteTally(reading, text)).toEqual({ found: 2, total: 3 });
  });
});
