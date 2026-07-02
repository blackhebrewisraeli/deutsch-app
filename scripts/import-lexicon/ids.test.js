import { describe, it, expect } from 'vitest';
import { posPrefix, slug, entryId, disambiguateIds, cefrForRank } from './ids.js';

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
});

describe('cefrForRank', () => {
  it('maps rank to band', () => {
    expect(cefrForRank(1)).toBe('A1');
    expect(cefrForRank(1000)).toBe('A1');
    expect(cefrForRank(1001)).toBe('A2');
    expect(cefrForRank(2500)).toBe('A2');
    expect(cefrForRank(2501)).toBe('B1');
    expect(cefrForRank(5000)).toBe('B1');
    expect(cefrForRank(null)).toBe(null);
  });
});
