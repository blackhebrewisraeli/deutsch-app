import { describe, it, expect } from 'vitest';
import { shuffle, levenshtein } from './utils';

describe('shuffle', () => {
  it('returns a new array (does not mutate input)', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);
    expect(result).not.toBe(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it('preserves length', () => {
    const input = ['a', 'b', 'c', 'd'];
    expect(shuffle(input)).toHaveLength(4);
  });

  it('preserves elements (same multiset)', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = shuffle(input);
    expect(result.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('handles empty array', () => {
    expect(shuffle([])).toEqual([]);
  });

  it('handles single-element array', () => {
    expect(shuffle(['only'])).toEqual(['only']);
  });

  it('handles arrays of objects (reference equality preserved)', () => {
    const a = { id: 1 };
    const b = { id: 2 };
    const result = shuffle([a, b]);
    expect(result).toContain(a);
    expect(result).toContain(b);
  });
});

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('cat', 'cat')).toBe(0);
  });

  it('is case-insensitive', () => {
    expect(levenshtein('Cat', 'cat')).toBe(0);
    expect(levenshtein('HELLO', 'hello')).toBe(0);
  });

  it('counts a single substitution as 1', () => {
    expect(levenshtein('cat', 'bat')).toBe(1);
  });

  it('counts a single insertion as 1', () => {
    expect(levenshtein('cat', 'cats')).toBe(1);
  });

  it('counts a single deletion as 1', () => {
    expect(levenshtein('cats', 'cat')).toBe(1);
  });

  it('counts adjacent transposition as 2 (not optimized for it)', () => {
    // Classic Levenshtein treats swap as delete + insert (or 2 substitutions).
    // Damerau-Levenshtein would return 1 here. We use the classic form.
    expect(levenshtein('ab', 'ba')).toBe(2);
  });

  it('handles empty strings', () => {
    expect(levenshtein('', '')).toBe(0);
    expect(levenshtein('', 'cat')).toBe(3);
    expect(levenshtein('cat', '')).toBe(3);
  });

  it('returns distance proportional to differences', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3); // canonical example
    expect(levenshtein('hallo', 'hallo')).toBe(0);
    expect(levenshtein('hallo', 'helo')).toBe(2); // a→e + delete l
  });

  it('works with German characters and IPA-adjacent text', () => {
    expect(levenshtein('Tschüss', 'Tschuss')).toBe(1); // ü vs u
    expect(levenshtein('grün', 'gruen')).toBe(2); // ü → ue
  });
});
