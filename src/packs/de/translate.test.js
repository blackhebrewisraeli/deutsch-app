// Data-shape invariants for src/packs/de/translate.js.
//
// These tests do NOT validate German grammar — they validate the contract the
// rest of the app depends on (e.g., "every vocab card has IPA", "A2 templates
// have one blank per word"). When someone adds content and forgets a field,
// these tests catch it before merge.

import { describe, it, expect } from 'vitest';
import {
  TRANSLATE_SENTENCES_A1,
  TRANSLATE_SENTENCES_A2,
  TRANSLATE_SENTENCES_B1,
} from './translate';

describe('TRANSLATE_SENTENCES_A1 (word tiles)', () => {
  it('has exactly 10 sentences', () => {
    expect(TRANSLATE_SENTENCES_A1).toHaveLength(10);
  });

  it('every sentence has { en, de, words[], distractors[], note }', () => {
    for (const s of TRANSLATE_SENTENCES_A1) {
      expect(typeof s.en).toBe('string');
      expect(s.en.length).toBeGreaterThan(0);
      expect(typeof s.de).toBe('string');
      expect(s.de.length).toBeGreaterThan(0);
      expect(Array.isArray(s.words)).toBe(true);
      expect(s.words.length).toBeGreaterThan(0);
      expect(Array.isArray(s.distractors)).toBe(true);
      expect(typeof s.note).toBe('string');
    }
  });

  it('words joined with single spaces equal the de sentence', () => {
    for (const s of TRANSLATE_SENTENCES_A1) {
      expect(s.words.join(' ')).toBe(s.de);
    }
  });

  it('distractors are disjoint from the correct words', () => {
    for (const s of TRANSLATE_SENTENCES_A1) {
      const correct = new Set(s.words);
      for (const d of s.distractors) {
        expect(correct.has(d)).toBe(false);
      }
    }
  });
});

describe('TRANSLATE_SENTENCES_A2 (fill blanks)', () => {
  it('has exactly 10 sentences', () => {
    expect(TRANSLATE_SENTENCES_A2).toHaveLength(10);
  });

  it('every sentence has { en, de, template, blanks[], note }', () => {
    for (const s of TRANSLATE_SENTENCES_A2) {
      expect(typeof s.en).toBe('string');
      expect(typeof s.de).toBe('string');
      expect(typeof s.template).toBe('string');
      expect(Array.isArray(s.blanks)).toBe(true);
      expect(s.blanks.length).toBeGreaterThan(0);
      expect(typeof s.note).toBe('string');
    }
  });

  it('template has exactly one ___ per blank', () => {
    for (const s of TRANSLATE_SENTENCES_A2) {
      const blankCount = (s.template.match(/___/g) || []).length;
      expect(blankCount).toBe(s.blanks.length);
    }
  });

  it('every blank has { word, distractors[] } with disjoint sets', () => {
    for (const s of TRANSLATE_SENTENCES_A2) {
      for (const b of s.blanks) {
        expect(typeof b.word).toBe('string');
        expect(b.word.length).toBeGreaterThan(0);
        expect(Array.isArray(b.distractors)).toBe(true);
        expect(b.distractors).not.toContain(b.word);
      }
    }
  });

  it('substituting blank words into the template yields the de sentence', () => {
    for (const s of TRANSLATE_SENTENCES_A2) {
      let filled = s.template;
      for (const b of s.blanks) {
        filled = filled.replace('___', b.word);
      }
      expect(filled).toBe(s.de);
    }
  });
});

describe('TRANSLATE_SENTENCES_B1 (free typing)', () => {
  it('has exactly 10 sentences', () => {
    expect(TRANSLATE_SENTENCES_B1).toHaveLength(10);
  });

  it('every sentence has { en, de, note } as non-empty strings', () => {
    for (const s of TRANSLATE_SENTENCES_B1) {
      expect(typeof s.en).toBe('string');
      expect(s.en.length).toBeGreaterThan(0);
      expect(typeof s.de).toBe('string');
      expect(s.de.length).toBeGreaterThan(0);
      expect(typeof s.note).toBe('string');
      expect(s.note.length).toBeGreaterThan(0);
    }
  });
});
