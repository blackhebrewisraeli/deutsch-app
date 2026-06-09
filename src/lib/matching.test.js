import { describe, it, expect } from 'vitest';
import { exactMatch, fuzzyMatch } from './matching';

const norm = (s) => s.trim().toLowerCase();

describe('exactMatch', () => {
  it('is true for equal strings after normalize', () => {
    expect(exactMatch('Die Katze ist groß.', '  die katze ist groß.  ', norm)).toBe(true);
  });
  it('is false when content differs', () => {
    expect(exactMatch('Er isst Brot.', 'Er trinkt Brot.', norm)).toBe(false);
  });
});

describe('fuzzyMatch', () => {
  it('reports distance 0 and ok for an exact (normalized) match', () => {
    expect(fuzzyMatch('apple', 'APPLE', norm)).toEqual({ ok: true, distance: 0 });
  });
  it('reports the edit distance for near matches', () => {
    expect(fuzzyMatch('apple', 'aple', norm)).toEqual({ ok: true, distance: 1 });
  });
  it('is not ok past maxDistance', () => {
    const res = fuzzyMatch('apple', 'orange', norm, 2);
    expect(res.ok).toBe(false);
    expect(res.distance).toBeGreaterThan(2);
  });
});
