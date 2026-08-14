// Data-shape invariants for src/packs/de/alphabet.js.
//
// These tests do NOT validate German grammar — they validate the contract the
// rest of the app depends on (e.g., "every vocab card has IPA", "A2 templates
// have one blank per word"). When someone adds content and forgets a field,
// these tests catch it before merge.

import { describe, it, expect } from 'vitest';
import { ALPHABET, ALPHABET_QUIZ_GROUPS } from './alphabet';

describe('ALPHABET', () => {
  it('has exactly 30 entries (A–Z + Ä Ö Ü ß)', () => {
    expect(ALPHABET).toHaveLength(30);
  });

  it('every entry has { l, w, e } with non-empty strings', () => {
    for (const entry of ALPHABET) {
      expect(typeof entry.l).toBe('string');
      expect(entry.l.length).toBeGreaterThan(0);
      expect(typeof entry.w).toBe('string');
      expect(entry.w.length).toBeGreaterThan(0);
      expect(typeof entry.e).toBe('string');
      expect(entry.e.length).toBeGreaterThan(0);
    }
  });

  it('all letters are unique', () => {
    const letters = ALPHABET.map((e) => e.l);
    expect(new Set(letters).size).toBe(letters.length);
  });

  it('includes all 26 ASCII letters A–Z', () => {
    const letters = new Set(ALPHABET.map((e) => e.l));
    for (let code = 65; code <= 90; code++) {
      expect(letters.has(String.fromCharCode(code))).toBe(true);
    }
  });

  it('includes the four German-specific characters Ä Ö Ü ß', () => {
    const letters = new Set(ALPHABET.map((e) => e.l));
    for (const ch of ['Ä', 'Ö', 'Ü', 'ß']) {
      expect(letters.has(ch)).toBe(true);
    }
  });

  it('example word starts with the letter (except ß, which has no word-initial form)', () => {
    for (const { l, w } of ALPHABET) {
      if (l === 'ß') continue; // ß never appears word-initially in German
      expect(w[0].toUpperCase()).toBe(l.toUpperCase());
    }
  });
});

describe('ALPHABET_QUIZ_GROUPS', () => {
  it('has 8 groups (the count documented in the checklist)', () => {
    expect(ALPHABET_QUIZ_GROUPS).toHaveLength(8);
  });

  it('every group has exactly 4 letters', () => {
    for (const g of ALPHABET_QUIZ_GROUPS) {
      expect(g.letters).toHaveLength(4);
    }
  });

  it('every letter in every group exists in ALPHABET', () => {
    const alphabetSet = new Set(ALPHABET.map((e) => e.l));
    for (const g of ALPHABET_QUIZ_GROUPS) {
      for (const letter of g.letters) {
        expect(alphabetSet.has(letter)).toBe(true);
      }
    }
  });

  it('no duplicate letters within a group', () => {
    for (const g of ALPHABET_QUIZ_GROUPS) {
      expect(new Set(g.letters).size).toBe(g.letters.length);
    }
  });
});

describe('special letters', () => {
  it('flags exactly the four letters outside the base Latin set', () => {
    const special = ALPHABET.filter((x) => x.special).map((x) => x.l);
    expect(special).toEqual(['Ä', 'Ö', 'Ü', 'ß']);
  });

  it('leaves every other entry unflagged', () => {
    const plain = ALPHABET.filter((x) => !x.special);
    expect(plain).toHaveLength(26);
    for (const entry of plain) {
      expect(entry.special).toBeUndefined();
    }
  });
});
