import { describe, it, expect } from 'vitest';
import { posPrefix, slug, entryId, disambiguateIds } from './ids.js';
import { parseRecord } from './parseWiktextract.js';

describe('posPrefix', () => {
  it('maps known pos and falls back to x', () => {
    expect(posPrefix('noun')).toBe('n');
    expect(posPrefix('verb')).toBe('v');
    expect(posPrefix('adj')).toBe('adj');
    expect(posPrefix('whatever')).toBe('x');
  });
});

describe('slug', () => {
  it('lowercases and keeps German letters', () => {
    expect(slug('Brot')).toBe('brot');
    expect(slug('Fußgänger')).toBe('fußgänger');
    expect(slug('Wo ist...?')).toBe('wo-ist');
    expect(slug('zu Hause')).toBe('zu-hause');
  });
});

describe('entryId', () => {
  it('combines pos prefix and lemma slug', () => {
    expect(entryId('noun', 'Brot')).toBe('n:brot');
    expect(entryId('verb', 'gehen')).toBe('v:gehen');
  });
});

describe('disambiguateIds', () => {
  it('leaves unique ids unsuffixed', () => {
    const out = disambiguateIds([
      { pos: 'noun', lemma: 'Brot', glosses: ['bread'] },
      { pos: 'verb', lemma: 'gehen', glosses: ['to go'] },
    ]);
    expect(out.map((e) => e.id)).toEqual(['n:brot', 'v:gehen']);
  });
  it('suffixes ALL members of a collision with the gloss slug', () => {
    const out = disambiguateIds([
      { pos: 'noun', lemma: 'Bank', glosses: ['bench'] },
      { pos: 'noun', lemma: 'Bank', glosses: ['financial institution'] },
    ]);
    expect(out.map((e) => e.id).sort()).toEqual(['n:bank:bench', 'n:bank:financial-institution']);
  });
  it('is order-independent for the same input set', () => {
    const a = disambiguateIds([
      { pos: 'noun', lemma: 'Bank', glosses: ['bench'] },
      { pos: 'noun', lemma: 'Bank', glosses: ['bank'] },
    ]).map((e) => e.id).sort();
    const b = disambiguateIds([
      { pos: 'noun', lemma: 'Bank', glosses: ['bank'] },
      { pos: 'noun', lemma: 'Bank', glosses: ['bench'] },
    ]).map((e) => e.id).sort();
    expect(a).toEqual(b);
  });

  it('builds the collision suffix from the raw gloss, not the cleaned one', () => {
    const out = disambiguateIds([
      { pos: 'noun', lemma: 'Tag', glosses: ['day'], rawGlosses: ['day (a 24-hour period)'] },
      { pos: 'noun', lemma: 'Tag', glosses: ['tag'], rawGlosses: ['tag (label)'] },
    ]);
    expect(out.map((e) => e.id)).toEqual(['n:tag:day-a-24-hour-period', 'n:tag:tag-label']);
  });

  it('falls back to the cleaned gloss when rawGlosses is absent', () => {
    const out = disambiguateIds([
      { pos: 'noun', lemma: 'Tag', glosses: ['day'] },
      { pos: 'noun', lemma: 'Tag', glosses: ['tag'] },
    ]);
    expect(out.map((e) => e.id)).toEqual(['n:tag:day', 'n:tag:tag']);
  });

  // End-to-end: pipe real records through parseRecord (the actual gloss-cleaning
  // stage) and then disambiguateIds (the actual id-building stage). This is the
  // wiring the unit tests above don't cover — if a future edit stopped carrying
  // rawGlosses through parseRecord, ids would silently revert to cleaned-gloss
  // slugs (collapsing two distinct senses onto the same suffix, or worse,
  // resetting ids that keyed learnedWords / srsKey) and the suite would stay
  // green because disambiguateIds itself still works fine on hand-built input.
  it('keeps ids on RAW-gloss slugs end-to-end through parseRecord + disambiguateIds', () => {
    const recordA = {
      word: 'Bank',
      pos: 'noun',
      lang_code: 'de',
      forms: [],
      sounds: [],
      senses: [{ glosses: ['bench (a seat for sitting)'], tags: [] }],
    };
    const recordB = {
      word: 'Bank',
      pos: 'noun',
      lang_code: 'de',
      forms: [],
      sounds: [],
      senses: [{ glosses: ['bench (a seat outdoors)'], tags: [] }],
    };

    const parsedA = parseRecord(recordA);
    const parsedB = parseRecord(recordB);
    // Cleaning collapses both trailing parentheticals to the same display text —
    // this is the condition under which id stability actually matters.
    expect(parsedA.glosses).toEqual(['bench']);
    expect(parsedB.glosses).toEqual(['bench']);
    expect(parsedA.rawGlosses[0]).not.toBe(parsedB.rawGlosses[0]);

    const out = disambiguateIds([parsedA, parsedB]);
    expect(out.map((e) => e.id)).toEqual([
      'n:bank:bench-a-seat-for-sitting',
      'n:bank:bench-a-seat-outdoors',
    ]);
  });
});
