import { describe, it, expect } from 'vitest';
import { exactMatch, fuzzyMatch } from './matching';
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
