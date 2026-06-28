// Data-shape invariants for src/data/content.js.
//
// These tests do NOT validate German grammar — they validate the contract the
// rest of the app depends on (e.g., "every vocab card has IPA", "A2 templates
// have one blank per word"). When someone adds content and forgets a field,
// these tests catch it before merge.

import { describe, it, expect } from 'vitest';
import {
  ALPHABET,
  SCENARIOS,
  CHAT_TASKS,
  TRANSLATE_SENTENCES_A1,
  TRANSLATE_SENTENCES_A2,
  TRANSLATE_SENTENCES_B1,
  ALPHABET_QUIZ_GROUPS,
} from './content';

const SCENARIO_IDS = ['free', 'coffee', 'meet', 'airport'];
const LEVELS = ['a1', 'a2', 'b1'];

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

describe('SCENARIOS', () => {
  it('has exactly 4 scenarios', () => {
    expect(SCENARIOS).toHaveLength(4);
  });

  it('exposes the expected ids', () => {
    expect(SCENARIOS.map((s) => s.id).sort()).toEqual([...SCENARIO_IDS].sort());
  });

  it('every scenario has { id, name, icon, desc } as non-empty strings', () => {
    for (const s of SCENARIOS) {
      for (const field of ['id', 'name', 'icon', 'desc']) {
        expect(typeof s[field]).toBe('string');
        expect(s[field].length).toBeGreaterThan(0);
      }
    }
  });
});

describe('CHAT_TASKS', () => {
  it('top-level keys match SCENARIO ids', () => {
    expect(Object.keys(CHAT_TASKS).sort()).toEqual([...SCENARIO_IDS].sort());
  });

  it.each(SCENARIO_IDS)('scenario "%s" has tasks for every level (a1/a2/b1)', (sid) => {
    for (const level of LEVELS) {
      expect(Array.isArray(CHAT_TASKS[sid][level])).toBe(true);
      expect(CHAT_TASKS[sid][level].length).toBeGreaterThan(0);
    }
  });

  it('every task has a non-empty task string', () => {
    for (const sid of SCENARIO_IDS) {
      for (const level of LEVELS) {
        for (const t of CHAT_TASKS[sid][level]) {
          expect(typeof t.task).toBe('string');
          expect(t.task.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('hint is a string at A1/A2 and null at B1 (matches checklist)', () => {
    for (const sid of SCENARIO_IDS) {
      for (const t of CHAT_TASKS[sid].a1) {
        expect(typeof t.hint).toBe('string');
      }
      for (const t of CHAT_TASKS[sid].a2) {
        expect(typeof t.hint).toBe('string');
      }
      for (const t of CHAT_TASKS[sid].b1) {
        expect(t.hint).toBeNull();
      }
    }
  });
});

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
