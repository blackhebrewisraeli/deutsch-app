import { describe, it, expect } from 'vitest';
import { LEXICON } from './lexicon';
import { validateLexiconEntry } from '../validate';
import { grammar } from './grammar';
import { dePack } from './index';

const ids = Object.keys(LEXICON);

describe('LEXICON', () => {
  it('has 40 entries', () => {
    expect(ids).toHaveLength(40);
  });
  it('every entry key equals its entry.id', () => {
    for (const [id, entry] of Object.entries(LEXICON)) {
      expect(entry.id).toBe(id);
    }
  });
  it('every entry satisfies validateLexiconEntry', () => {
    const opts = { grammar, cefrLevels: dePack.meta.cefrLevels };
    for (const entry of Object.values(LEXICON)) {
      expect(validateLexiconEntry(entry, opts)).toBe(true);
    }
  });
  it('noun display form (article + lemma) equals the legacy surface id', () => {
    for (const entry of Object.values(LEXICON)) {
      if (entry.pos === 'noun') {
        expect(`${entry.article} ${entry.de}`).toBe(entry.id);
      }
    }
  });
  it('non-noun entries store the surface form directly in de and id', () => {
    for (const entry of Object.values(LEXICON)) {
      if (entry.pos !== 'noun') {
        expect(entry.de).toBe(entry.id);
      }
    }
  });
});

import { DECKS } from './decks';

describe('DECKS', () => {
  it('has the 4 legacy decks in order', () => {
    expect(Object.keys(DECKS)).toEqual(['greetings', 'food', 'travel', 'numbers']);
  });
  it('each curated deck has 10 cardIds, all resolvable in LEXICON', () => {
    for (const def of Object.values(DECKS)) {
      expect(def.cardIds).toHaveLength(10);
      for (const id of def.cardIds) {
        expect(LEXICON[id]).toBeDefined();
      }
    }
  });
  it('every deck has a name and icon', () => {
    for (const def of Object.values(DECKS)) {
      expect(typeof def.name).toBe('string');
      expect(def.name.length).toBeGreaterThan(0);
      expect(typeof def.icon).toBe('string');
      expect(def.icon.length).toBeGreaterThan(0);
    }
  });
});
