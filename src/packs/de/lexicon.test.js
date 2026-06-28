import { describe, it, expect } from 'vitest';
import { LEXICON } from './lexicon';
import { validateLexiconEntry } from '../validate';

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
    for (const entry of Object.values(LEXICON)) {
      expect(validateLexiconEntry(entry)).toBe(true);
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
