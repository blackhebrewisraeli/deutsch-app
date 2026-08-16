import { describe, it, expect } from 'vitest';
import { exactMatch, fuzzyMatch, glossCandidates, bestGlossMatch } from './matching';
import { CHOICE, ANSWER } from './textRules';

describe('exactMatch', () => {
  it('defaults to CHOICE — trims and folds case', () => {
    expect(exactMatch('Die Katze ist groß.', '  Die Katze ist groß.  ')).toBe(true);
    expect(exactMatch('Die Katze ist groß.', 'die katze ist groß.')).toBe(true);
  });

  // A pack's ß→ss never reaches a tile comparison.
  it('does not apply pack substitutions, so Fuß is not Fuss', () => {
    expect(exactMatch('Fuß', 'Fuss')).toBe(false);
  });

  it('is false when content differs', () => {
    expect(exactMatch('Er isst Brot.', 'Er trinkt Brot.', CHOICE)).toBe(false);
  });

  it('case-folds when handed ANSWER', () => {
    expect(exactMatch('Die Katze ist groß.', '  die katze ist groß.  ', ANSWER)).toBe(true);
  });
});

describe('fuzzyMatch', () => {
  it('reports distance 0 and ok for an exact match', () => {
    expect(fuzzyMatch('apple', 'APPLE', ANSWER)).toEqual({ ok: true, distance: 0 });
  });

  it('reports the edit distance for near matches', () => {
    expect(fuzzyMatch('apple', 'aple', ANSWER)).toEqual({ ok: true, distance: 1 });
  });

  it('is not ok past maxDistance', () => {
    const res = fuzzyMatch('apple', 'orange', ANSWER, 2);
    expect(res.ok).toBe(false);
    expect(res.distance).toBeGreaterThan(2);
  });

  it('defaults to ANSWER so a caller can omit the rules', () => {
    expect(fuzzyMatch('apple', '  apple  ')).toEqual({ ok: true, distance: 0 });
  });
});

describe('glossCandidates', () => {
  const UHR = ["hours, o'clock", 'clock, watch', 'meter; gauge'];

  it('keeps each whole gloss AND its synonym runs', () => {
    // The whole gloss must survive: it is what grades correct today, and
    // nothing that passes now may start failing.
    const c = glossCandidates(UHR);
    expect(c).toContain("hours, o'clock");
    expect(c).toContain('clock');
    expect(c).toContain('watch');
    expect(c).toContain('gauge');
  });

  it('splits on the separators the shipped data actually uses', () => {
    expect(glossCandidates(['a, b'])).toContain('b');
    expect(glossCandidates(['a; b'])).toContain('b');
    expect(glossCandidates(['a \u00b7 b'])).toContain('b');
    expect(glossCandidates(['a / b'])).toContain('b');
  });

  it('accepts a bare string as well as an array', () => {
    expect(glossCandidates('clock, watch')).toEqual(
      expect.arrayContaining(['clock, watch', 'clock', 'watch'])
    );
  });

  it('trims, drops empties and dedupes', () => {
    expect(glossCandidates(['a,  a , '])).toEqual(['a,  a ,', 'a']);
  });

  it('is empty for nothing', () => {
    expect(glossCandidates(undefined)).toEqual([]);
    expect(glossCandidates([])).toEqual([]);
  });
});

describe('bestGlossMatch', () => {
  const UHR = ["hours, o'clock", 'clock, watch', 'meter; gauge'];

  it('accepts a secondary meaning — the bug this fixes', () => {
    // Today: fuzzyMatch(card.en, 'clock') is distance 9, i.e. WRONG.
    expect(bestGlossMatch(UHR, 'clock').distance).toBe(0);
    expect(bestGlossMatch(UHR, 'watch').distance).toBe(0);
    expect(bestGlossMatch(UHR, 'gauge').distance).toBe(0);
  });

  it('still accepts the primary gloss exactly', () => {
    expect(bestGlossMatch(UHR, "hours, o'clock").distance).toBe(0);
  });

  it('reports the BEST distance, so the almost band still works', () => {
    expect(bestGlossMatch(UHR, 'clocl').distance).toBe(1);
  });

  it('is far for an unrelated answer', () => {
    expect(bestGlossMatch(UHR, 'zzzzzzzzzz').distance).toBeGreaterThan(2);
  });

  it('names which candidate matched, for the caller to record', () => {
    expect(bestGlossMatch(UHR, 'watch').matched).toBe('watch');
  });

  it('has no match at all for an empty gloss list', () => {
    expect(bestGlossMatch([], 'anything').distance).toBe(Infinity);
  });
});
